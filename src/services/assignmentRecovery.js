const Ride = require('../models/Ride');
const { rideQueue } = require('../config/rideQueue');

const MAX_RECOVERIES = 3;
const RECOVERY_LEASE_MS = 60_000;
const INACTIVE_JOB_STATES = new Set(['missing', 'failed', 'completed']);

async function getJobState(rideId) {
  const job = await rideQueue.getJob(rideId);
  if (!job) return { job: null, state: 'missing' };
  return { job, state: await job.getState() };
}

async function releaseRecoveryLock(rideId, leaseUntil) {
  await Ride.updateOne(
    { rideId, status: 'REQUESTED', recoveryLockUntil: leaseUntil },
    { $set: { recoveryLockUntil: null } },
  );
}

async function rollbackRecoveryClaim(rideId, leaseUntil) {
  await Ride.updateOne(
    { rideId, status: 'REQUESTED', recoveryLockUntil: leaseUntil },
    { $inc: { recoveryAttempts: -1 }, $set: { recoveryLockUntil: null } },
  );
}

async function recoverRide(ride) {
  let snapshot;
  try {
    snapshot = await getJobState(ride.rideId);
  } catch (error) {
    console.error(`${ride.rideId}: could not inspect assignment job: ${error.message}`);
    return;
  }
  if (!INACTIVE_JOB_STATES.has(snapshot.state)) return;

  const now = new Date();
  const leaseUntil = new Date(now.getTime() + RECOVERY_LEASE_MS);
  const recoveryAttempts = ride.recoveryAttempts || 0;
  const attemptsFilter = recoveryAttempts === 0
    ? { $or: [{ recoveryAttempts: 0 }, { recoveryAttempts: { $exists: false } }] }
    : { recoveryAttempts };
  const claimed = await Ride.updateOne({
    _id: ride._id,
    status: 'REQUESTED',
    $and: [
      attemptsFilter,
      { $or: [{ recoveryLockUntil: null }, { recoveryLockUntil: { $lte: now } }] },
    ],
  }, {
    $set: { recoveryLockUntil: leaseUntil },
    ...(recoveryAttempts < MAX_RECOVERIES ? { $inc: { recoveryAttempts: 1 } } : {}),
  });
  if (!claimed.modifiedCount) return;

  try {
    // Check again after acquiring the MongoDB lease; another reconciler may have queued the job.
    const current = await getJobState(ride.rideId);
    if (!INACTIVE_JOB_STATES.has(current.state)) {
      console.log(`${ride.rideId}: recovery skipped; job is ${current.state || 'in an unknown state'}`);
      if (recoveryAttempts < MAX_RECOVERIES) {
        await rollbackRecoveryClaim(ride.rideId, leaseUntil);
      }
      return;
    }

    if (recoveryAttempts >= MAX_RECOVERIES) {
      const failed = await Ride.updateOne(
        { _id: ride._id, status: 'REQUESTED', recoveryLockUntil: leaseUntil },
        { $set: { status: 'ASSIGNMENT_FAILED', recoveryLockUntil: null } },
      );
      if (failed.modifiedCount) {
        console.error(`${ride.rideId}: assignment stopped after ${MAX_RECOVERIES} recoveries; job remained inactive`);
      }
      return;
    }

    if (current.job) {
      await current.job.retry(current.state, {
        resetAttemptsMade: true,
        resetAttemptsStarted: true,
      });
    } else {
      await rideQueue.add('assign-driver', { rideId: ride.rideId }, {
        jobId: ride.rideId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });
    }
    const recoveryCount = recoveryAttempts + 1;
    console.log(`${ride.rideId}: requeued inactive assignment job (recovery ${recoveryCount}/${MAX_RECOVERIES})`);
  } catch (error) {
    console.error(`${ride.rideId}: assignment recovery failed: ${error.message}`);
  } finally {
    try {
      await releaseRecoveryLock(ride.rideId, leaseUntil);
    } catch (error) {
      // The lease expires automatically if MongoDB is temporarily unavailable.
      console.error(`${ride.rideId}: could not release recovery lease: ${error.message}`);
    }
  }
}

async function reconcileRequestedRides() {
  const rides = await Ride.find({ status: 'REQUESTED' })
    .select('_id rideId recoveryAttempts recoveryLockUntil')
    .lean();
  for (const ride of rides) {
    try {
      await recoverRide(ride);
    } catch (error) {
      console.error(`${ride.rideId}: reconciliation failed: ${error.message}`);
    }
  }
}

module.exports = { MAX_RECOVERIES, reconcileRequestedRides };
