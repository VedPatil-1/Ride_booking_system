const Ride = require('../models/Ride');
const { testDriverRejectionsEnabled } = require('../config/env');
const {
  createRideStatusEvent,
  publishPendingRideEvents,
} = require('../events/rideEventPublisher');

const DRIVERS = Array.from({ length: 10 }, (_, index) => `DRIVER${String(index + 1).padStart(3, '0')}`);

function driverAccepts(forceRejection = false) {
  if (forceRejection && testDriverRejectionsEnabled) return false;
  return Math.random() < 0.5;
}

async function assignRide(rideId) {
  for (;;) {
    const ride = await Ride.findOne({ rideId }).select('+testForceRejections').lean();
    if (!ride) {
      console.error(`Ride ${rideId} was not found; assignment skipped`);
      return;
    }
    if (ride.status !== 'REQUESTED') {
      await publishPendingRideEvents(rideId);
      return;
    }

    console.log(
      `${rideId}: assignment test mode enabled=${testDriverRejectionsEnabled}, `
      + `persisted ride test flag=${ride.testForceRejections === true}`,
    );

    if (ride.rejectedDrivers.length >= 3) {
      const event = createRideStatusEvent(ride, 'NO_DRIVER_FOUND');
      const result = await Ride.updateOne(
        { rideId, status: 'REQUESTED', rejectedDrivers: { $size: 3 } },
        {
          $set: { status: 'NO_DRIVER_FOUND' },
          $unset: { pendingOffer: 1 },
          $push: { pendingEvents: event },
        },
      );
      if (result.modifiedCount) {
        console.log(`${rideId}: no driver found after 3 rejections`);
        await publishPendingRideEvents(rideId);
      }
      return;
    }

    let pendingOffer = ride.pendingOffer;
    if (!pendingOffer?.driverId) {
      const driverId = DRIVERS.find((candidate) => !ride.rejectedDrivers.includes(candidate));
      if (!driverId) {
        // This is an infrastructure/consistency failure, not three confirmed rejections.
        await Ride.updateOne({ rideId, status: 'REQUESTED' }, { $set: { status: 'ASSIGNMENT_FAILED' } });
        console.error(`${rideId}: no eligible drivers remain without three rejections`);
        return;
      }

      const reserved = await Ride.updateOne(
        { rideId, status: 'REQUESTED', rejectedDrivers: ride.rejectedDrivers, pendingOffer: null },
        { $set: { pendingOffer: { driverId, response: null } } },
      );
      if (!reserved.modifiedCount) continue;
      pendingOffer = { driverId, response: null };
      console.log(`${rideId}: offering ride to ${driverId}`);
    } else {
      console.log(`${rideId}: resuming pending offer to ${pendingOffer.driverId}`);
    }

    // Persist the simulated response before applying it so a retry can resume the same offer.
    if (!pendingOffer.response) {
      const response = driverAccepts(ride.testForceRejections) ? 'ACCEPTED' : 'REJECTED';
      const saved = await Ride.updateOne(
        { rideId, status: 'REQUESTED', 'pendingOffer.driverId': pendingOffer.driverId, 'pendingOffer.response': null },
        { $set: { 'pendingOffer.response': response } },
      );
      if (!saved.modifiedCount) continue;
      pendingOffer.response = response;
    }

    if (pendingOffer.response === 'ACCEPTED') {
      const assigned = await Ride.updateOne(
        {
          rideId,
          status: 'REQUESTED',
          assignedDriver: null,
          'pendingOffer.driverId': pendingOffer.driverId,
          'pendingOffer.response': 'ACCEPTED',
        },
        {
          $set: { status: 'ASSIGNED', assignedDriver: pendingOffer.driverId },
          $unset: { pendingOffer: 1 },
          $push: { pendingEvents: createRideStatusEvent(ride, 'ASSIGNED') },
        },
      );
      if (assigned.modifiedCount) {
        console.log(`${rideId}: ${pendingOffer.driverId} accepted; ride assigned`);
        await publishPendingRideEvents(rideId);
        return;
      }
      continue;
    }

    if (pendingOffer.response === 'REJECTED') {
      const rejected = await Ride.updateOne(
        {
          rideId,
          status: 'REQUESTED',
          rejectedDrivers: ride.rejectedDrivers,
          'pendingOffer.driverId': pendingOffer.driverId,
          'pendingOffer.response': 'REJECTED',
        },
        { $addToSet: { rejectedDrivers: pendingOffer.driverId }, $unset: { pendingOffer: 1 } },
      );
      if (rejected.modifiedCount) console.log(`${rideId}: ${pendingOffer.driverId} rejected`);
      // The next iteration marks NO_DRIVER_FOUND only after the third persisted rejection.
    } else {
      throw new Error(`${rideId}: pending offer has an invalid response`);
    }
  }
}

module.exports = { DRIVERS, assignRide, driverAccepts };
