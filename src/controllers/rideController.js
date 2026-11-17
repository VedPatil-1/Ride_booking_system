const { randomUUID } = require('node:crypto');
const Ride = require('../models/Ride');
const { rideQueue } = require('../config/rideQueue');
const {
  createRideStatusEvent,
  publishPendingRideEvents,
} = require('../events/rideEventPublisher');
const {
  testDriverRejectionsEnabled,
  testAssignmentFailuresEnabled,
} = require('../config/env');

async function createRide(request, response, next) {
  const {
    riderId,
    pickup,
    destination,
    testForceRejections,
    testWorkerFailures,
  } = request.body || {};
  if ([riderId, pickup, destination].some((value) => typeof value !== 'string' || !value.trim())) {
    return response.status(400).json({ error: 'riderId, pickup, and destination are required strings' });
  }
  if (testForceRejections !== undefined && typeof testForceRejections !== 'boolean') {
    return response.status(400).json({ error: 'testForceRejections must be a boolean' });
  }
  if (testForceRejections && !testDriverRejectionsEnabled) {
    return response.status(400).json({ error: 'Test driver rejections are not enabled' });
  }
  if (testWorkerFailures !== undefined
    && (!Number.isInteger(testWorkerFailures) || testWorkerFailures < 1 || testWorkerFailures > 3)) {
    return response.status(400).json({ error: 'testWorkerFailures must be an integer from 1 to 3' });
  }
  if (testWorkerFailures !== undefined && !testAssignmentFailuresEnabled) {
    return response.status(400).json({ error: 'Test assignment failures are not enabled' });
  }

  let ride;
  try {
    const rideData = {
      rideId: `RIDE-${randomUUID()}`,
      riderId: riderId.trim(),
      pickup: pickup.trim(),
      destination: destination.trim(),
      status: 'REQUESTED',
    };
    ride = await Ride.create({
      ...rideData,
      testForceRejections: testForceRejections === true,
      testWorkerFailuresRemaining: testWorkerFailures || 0,
      pendingEvents: [createRideStatusEvent(rideData, 'REQUESTED')],
    });
    console.log(
      `${ride.rideId}: created; test mode enabled=${testDriverRejectionsEnabled}, `
      + `ride test flag=${testForceRejections === true}, `
      + `assignment failure mode enabled=${testAssignmentFailuresEnabled}, `
      + `requested worker failures=${testWorkerFailures || 0}`,
    );
    await rideQueue.add('assign-driver', { rideId: ride.rideId }, {
      jobId: ride.rideId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });

    try {
      await publishPendingRideEvents(ride.rideId);
    } catch (error) {
      console.error(
        `${ride.rideId}: REQUESTED event queued for retry (${error.code || error.name || 'error'})`,
      );
    }

    return response.status(202).json({
      rideId: ride.rideId,
      status: ride.status,
      message: 'Ride booked successfully',
    });
  } catch (error) {
    if (ride) {
      try {
        await Ride.deleteOne({ rideId: ride.rideId, status: 'REQUESTED' });
      } catch (cleanupError) {
        console.error('Failed to clean up ride after queue error:', cleanupError.message);
      }
    }
    return next(error);
  }
}

async function getRide(request, response, next) {
  try {
    const ride = await Ride.findOne({ rideId: request.params.rideId }).lean();
    if (!ride) return response.status(404).json({ error: 'Ride not found' });
    return response.status(200).json(ride);
  } catch (error) {
    return next(error);
  }
}

module.exports = { createRide, getRide };
