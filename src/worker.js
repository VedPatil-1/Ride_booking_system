const mongoose = require('mongoose');
const { Worker } = require('bullmq');
const { connectMongo } = require('./config/database');
const { connectRedis, redisClient } = require('./config/redis');
const { connection, RIDE_QUEUE_NAME, rideQueue } = require('./config/rideQueue');
const Ride = require('./models/Ride');
const { testAssignmentFailuresEnabled } = require('./config/env');
const { assignRide } = require('./services/driverAssignment');
const { reconcileRequestedRides } = require('./services/assignmentRecovery');
const { flushRideEventOutbox } = require('./events/rideEventPublisher');
const { startHeartbeat } = require('./services/processHeartbeat');

const RECOVERY_INTERVAL_MS = 15_000;

async function injectDevelopmentFailure(rideId) {
  if (!testAssignmentFailuresEnabled) return;

  const ride = await Ride.findOneAndUpdate(
    {
      rideId,
      status: 'REQUESTED',
      testWorkerFailuresRemaining: { $gt: 0 },
    },
    { $inc: { testWorkerFailuresRemaining: -1 } },
    { new: true },
  ).select('+testWorkerFailuresRemaining').lean();

  if (!ride) return;

  console.warn(
    `${rideId}: injected development-only worker failure; `
    + `${ride.testWorkerFailuresRemaining} test failures remain`,
  );
  throw new Error('Injected development-only worker failure');
}

async function startWorker() {
  try {
    await Promise.all([connectMongo(), connectRedis()]);
    const worker = new Worker(RIDE_QUEUE_NAME, async (job) => {
      console.log(`Processing ride ${job.data.rideId}`);
      console.log(`${job.data.rideId}: assignment failure test mode enabled=${testAssignmentFailuresEnabled}`);
      await injectDevelopmentFailure(job.data.rideId);
      await assignRide(job.data.rideId);
    }, { connection });

    worker.on('completed', (job) => console.log(`Job completed for ${job.data.rideId}`));
    worker.on('failed', (job, error) => console.error(
      `Job failed for ${job?.data.rideId} (attempt ${job?.attemptsMade}): ${error.code || error.name || 'error'}`,
    ));
    worker.on('error', (error) => console.error(`Worker error (${error.code || error.name || 'error'})`));
    console.log('Ride assignment worker listening');
    const stopHeartbeat = startHeartbeat(redisClient, 'assignment-worker');

    const reconcile = () => reconcileRequestedRides().catch((error) => {
      console.error('Ride assignment reconciliation failed:', error.message);
    });
    const flushEvents = () => flushRideEventOutbox().catch((error) => {
      console.error(`Ride event outbox scan failed (${error.code || error.name || 'error'})`);
    });
    void reconcile();
    void flushEvents();
    const recoveryTimer = setInterval(() => {
      void reconcile();
      void flushEvents();
    }, RECOVERY_INTERVAL_MS);
    recoveryTimer.unref();

    const shutdown = async (signal) => {
      console.log(`${signal} received; shutting down worker`);
      clearInterval(recoveryTimer);
      try {
        await stopHeartbeat();
        await worker.close();
        await rideQueue.close();
        await redisClient.quit();
        await mongoose.disconnect();
      } catch (error) {
        console.error('Worker shutdown failed:', error.message);
        process.exitCode = 1;
      }
    };
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error(`Worker startup failed (${error.code || error.name || 'error'})`);
    await Promise.allSettled([
      rideQueue.close(),
      redisClient.isOpen ? redisClient.quit() : Promise.resolve(),
      mongoose.disconnect(),
    ]);
    process.exitCode = 1;
  }
}

startWorker();
