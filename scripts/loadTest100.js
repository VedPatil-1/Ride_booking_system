const path = require('node:path');
const { randomUUID } = require('node:crypto');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const Ride = require('../src/models/Ride');

const RIDE_COUNT = 100;
const POLL_INTERVAL_MS = 1_000;
const REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_TEST_TIMEOUT_MS = 120_000;
const FINAL_STATUSES = new Set(['ASSIGNED', 'NO_DRIVER_FOUND']);
const STOP_STATUSES = new Set([...FINAL_STATUSES, 'ASSIGNMENT_FAILED']);

function safeMessage(value) {
  return String(value ?? '')
    .replace(/\b(?:rediss?|https?):\/\/[^\s"'`<>]+/gi, '[REDACTED_URL]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(["']?(?:password|passwd|token|secret|authorization|credential|api[_-]?key)["']?\s*[:=]\s*["']?)[^"',\s;}]+["']?/gi, '$1[REDACTED]')
    .slice(0, 300);
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getTestTimeout() {
  const configured = Number(process.env.LOAD_TEST_TIMEOUT_MS || DEFAULT_TEST_TIMEOUT_MS);
  if (!Number.isInteger(configured) || configured < 10_000 || configured > 600_000) {
    throw new Error('LOAD_TEST_TIMEOUT_MS must be an integer from 10000 to 600000');
  }
  return configured;
}

function recordAssignmentWrite(change, batchPrefix, assignmentWrites) {
  const rideId = change.fullDocument?.rideId;
  const assignedDriver = change.updateDescription?.updatedFields?.assignedDriver;
  if (!rideId || !rideId.startsWith(batchPrefix) || assignedDriver == null) return;

  const writes = assignmentWrites.get(rideId) || [];
  writes.push(assignedDriver);
  assignmentWrites.set(rideId, writes);
  console.log(`[change-stream] ${rideId}: assignedDriver write #${writes.length} (${assignedDriver})`);
}

async function openAssignmentChangeStream(batchPrefix, assignmentWrites) {
  const escapedPrefix = batchPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Model.watch() in this Mongoose version wraps the driver change stream and does not
  // expose tryNext(). Open the native collection stream to use the driver's bounded API.
  const collection = mongoose.connection.db?.collection(Ride.collection.name);
  if (!collection?.watch) {
    throw new Error('MongoDB native collection change streams are unavailable');
  }
  const stream = collection.watch([
    {
      $match: {
        operationType: 'update',
        'fullDocument.riderId': { $regex: `^${escapedPrefix}` },
        'updateDescription.updatedFields.assignedDriver': { $exists: true, $ne: null },
      },
    },
  ], { fullDocument: 'updateLookup', maxAwaitTimeMS: 250 });

  try {
    // tryNext initializes the server cursor and returns after maxAwaitTimeMS when empty.
    const firstChange = await stream.tryNext();
    if (firstChange) recordAssignmentWrite(firstChange, batchPrefix, assignmentWrites);
    return stream;
  } catch (error) {
    await stream.close().catch(() => {});
    throw new Error(`MongoDB change streams are unavailable: ${safeMessage(error.message)}`);
  }
}

async function startChangeStreamReader(stream, batchPrefix, assignmentWrites, state) {
  return (async () => {
    try {
      for (;;) {
        const change = await stream.tryNext();
        if (change) recordAssignmentWrite(change, batchPrefix, assignmentWrites);
        else if (state.drainRequested) break;
      }
    } catch (error) {
      state.error = error;
      console.error(`[change-stream] reader stopped: ${safeMessage(error.message)}`);
    }
  })();
}

async function postRide(baseUrl, batchPrefix, index) {
  const riderId = `${batchPrefix}${String(index + 1).padStart(3, '0')}`;
  try {
    const response = await fetch(`${baseUrl}/rides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ riderId, pickup: 'Panvel', destination: 'Mumbai' }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.json().catch(() => ({}));
    if (response.status !== 202 || !body.rideId) {
      return { ok: false, riderId, error: `HTTP ${response.status}: ${safeMessage(body.error || body.message || 'booking failed')}` };
    }
    return { ok: true, riderId, rideId: body.rideId };
  } catch (error) {
    return { ok: false, riderId, error: safeMessage(error.message) };
  }
}

async function pollRide(baseUrl, rideId, deadline) {
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/rides/${encodeURIComponent(rideId)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok && STOP_STATUSES.has(body.status)) return body;
      if (!response.ok) lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = safeMessage(error.message);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return { rideId, status: 'TIMEOUT', pollError: lastError || null };
}

async function readFinalRideRecords(rideIds) {
  return Ride.find({ rideId: { $in: rideIds } })
    .select('rideId riderId status assignedDriver rejectedDrivers')
    .lean();
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is required; no rides were submitted');
  const baseUrl = (process.env.LOAD_TEST_API_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  const timeoutMs = getTestTimeout();
  const batchPrefix = `LOADTEST-${Date.now()}-${randomUUID().slice(0, 8)}-`;
  const assignmentWrites = new Map();
  const results = [];
  let stream;
  let readerPromise;
  const readerState = { drainRequested: false, error: null };

  await mongoose.connect(mongoUri);
  try {
    try {
      stream = await openAssignmentChangeStream(batchPrefix, assignmentWrites);
    } catch (error) {
      throw new Error(`${error.message}; no rides were submitted`);
    }

    console.log('MongoDB assignment change stream is active; submitting 100 rides concurrently.');
    readerPromise = startChangeStreamReader(stream, batchPrefix, assignmentWrites, readerState);

    const bookings = await Promise.all(
      Array.from({ length: RIDE_COUNT }, (_, index) => postRide(baseUrl, batchPrefix, index)),
    );
    const created = bookings.filter((booking) => booking.ok);
    const bookingFailures = bookings.filter((booking) => !booking.ok);
    const rideIds = created.map((booking) => booking.rideId);
    console.log(`Booking requests completed: created=${created.length}; failed=${bookingFailures.length}`);
    for (const failure of bookingFailures) console.error(`Booking failed for ${failure.riderId}: ${failure.error}`);

    const deadline = Date.now() + timeoutMs;
    const polled = await Promise.all(rideIds.map((rideId) => pollRide(baseUrl, rideId, deadline)));
    const pollById = new Map(polled.map((ride) => [ride.rideId, ride]));

    let databaseRides = [];
    try {
      databaseRides = await readFinalRideRecords(rideIds);
    } catch (error) {
      console.error(`Could not verify final MongoDB ride records: ${safeMessage(error.message)}`);
    }

    // All rides are now final or timed out. Let the reader finish one empty bounded getMore
    // after consuming every currently available change before deriving the duplicate count.
    readerState.drainRequested = true;
    await readerPromise;

    const databaseById = new Map(databaseRides.map((ride) => [ride.rideId, ride]));
    const duplicateAssignments = [...assignmentWrites.entries()]
      .filter(([, writes]) => writes.length > 1)
      .map(([rideId, writes]) => ({ rideId, writes }));

    const assigned = databaseRides.filter((ride) => ride.status === 'ASSIGNED');
    const noDriverFound = databaseRides.filter((ride) => ride.status === 'NO_DRIVER_FOUND');
    const assignmentFailed = databaseRides.filter((ride) => ride.status === 'ASSIGNMENT_FAILED');
    const stuck = rideIds.filter((rideId) => !STOP_STATUSES.has(databaseById.get(rideId)?.status));
    const changeStreamFailed = Boolean(readerState.error);
    const unverified = rideIds.filter((rideId) => !databaseById.has(rideId));
    const finalStatusMismatch = rideIds.filter((rideId) => {
      const dbStatus = databaseById.get(rideId)?.status;
      const apiStatus = pollById.get(rideId)?.status;
      return dbStatus && STOP_STATUSES.has(dbStatus) && apiStatus !== dbStatus;
    });
    const expectedOutcomes = assigned.length + noDriverFound.length === RIDE_COUNT;
    const pass = created.length === RIDE_COUNT
      && expectedOutcomes
      && assignmentFailed.length === 0
      && stuck.length === 0
      && unverified.length === 0
      && finalStatusMismatch.length === 0
      && duplicateAssignments.length === 0
      && !changeStreamFailed;

    console.log('\n=== 100-Ride Load Test Summary ===');
    console.log(`Total rides created: ${created.length} (expected ${RIDE_COUNT})`);
    console.log(`Total rides ending ASSIGNED: ${assigned.length}`);
    console.log(`Total rides ending NO_DRIVER_FOUND: ${noDriverFound.length}`);
    console.log(`ASSIGNED + NO_DRIVER_FOUND: ${assigned.length + noDriverFound.length} (expected ${RIDE_COUNT})`);
    console.log(`Rides ending ASSIGNMENT_FAILED: ${assignmentFailed.length}`);
    console.log(`Rides assignedDriver written more than once: ${duplicateAssignments.length}`);
    console.log(`Rides without a final status: ${stuck.length}`);
    console.log(`Rides missing from final MongoDB verification: ${unverified.length}`);
    console.log(`API/MongoDB final-status mismatches: ${finalStatusMismatch.length}`);
    console.log(`Change-stream verification: ${changeStreamFailed ? 'FAILED' : 'complete'}`);
    if (bookingFailures.length) console.log(`Booking failure rider IDs: ${bookingFailures.map((item) => item.riderId).join(', ')}`);
    if (assignmentFailed.length) console.log(`Assignment-failed ride IDs: ${assignmentFailed.map((ride) => ride.rideId).join(', ')}`);
    if (stuck.length) console.log(`Stuck ride IDs: ${stuck.join(', ')}`);
    if (unverified.length) console.log(`Unverified ride IDs: ${unverified.join(', ')}`);
    if (finalStatusMismatch.length) console.log(`Status-mismatch ride IDs: ${finalStatusMismatch.join(', ')}`);
    if (duplicateAssignments.length) {
      console.log('Duplicate-assignment ride IDs and observed driver writes:');
      for (const duplicate of duplicateAssignments) console.log(`  ${duplicate.rideId}: ${duplicate.writes.join(', ')}`);
    }
    console.log(`RESULT: ${pass ? 'PASS' : 'FAIL'}`);

    if (!pass) process.exitCode = 1;
  } finally {
    if (stream && readerPromise) {
      readerState.drainRequested = true;
      await readerPromise;
      await stream.close().catch((error) => {
        console.error(`Change stream cleanup failed: ${safeMessage(error.message)}`);
        process.exitCode = 1;
      });
    } else if (stream) {
      await stream.close().catch(() => {});
    }
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(`Load test could not complete: ${safeMessage(error.message)}`);
  process.exitCode = 1;
});
