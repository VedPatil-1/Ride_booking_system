const { randomUUID } = require('node:crypto');
const Ride = require('../models/Ride');
const { redisClient } = require('../config/redis');
const { RIDE_EVENTS_STREAM } = require('./constants');
const RIDE_EVENT_STATUSES = new Set(['REQUESTED', 'ASSIGNED', 'NO_DRIVER_FOUND']);

const publishScript = `
local existing = redis.call('GET', KEYS[1])
if existing then
  return existing
end
local streamId = redis.call(
  'XADD', KEYS[2], '*',
  'eventId', ARGV[1],
  'eventType', ARGV[2],
  'rideId', ARGV[3],
  'riderId', ARGV[4],
  'pickup', ARGV[5],
  'destination', ARGV[6],
  'status', ARGV[7],
  'timestamp', ARGV[8]
)
redis.call('SET', KEYS[1], streamId)
return streamId
`;

function createRideStatusEvent(ride, status) {
  if (!RIDE_EVENT_STATUSES.has(status)) {
    throw new Error(`Unsupported ride event status: ${status}`);
  }

  return {
    eventId: randomUUID(),
    eventType: `RIDE_${status}`,
    rideId: ride.rideId,
    riderId: ride.riderId,
    pickup: ride.pickup,
    destination: ride.destination,
    status,
    timestamp: new Date().toISOString(),
  };
}

async function publishRideEvent(event) {
  return redisClient.eval(publishScript, {
    keys: [`${RIDE_EVENTS_STREAM}:dedupe:${event.eventId}`, RIDE_EVENTS_STREAM],
    arguments: [
      event.eventId,
      event.eventType,
      event.rideId,
      event.riderId,
      event.pickup,
      event.destination,
      event.status,
      event.timestamp,
    ],
  });
}

async function publishPendingRideEvents(rideId) {
  for (;;) {
    const ride = await Ride.findOne({ rideId }).select('+pendingEvents').lean();
    const event = ride?.pendingEvents?.[0];
    if (!event) return;

    await publishRideEvent(event);
    await Ride.updateOne(
      { rideId, 'pendingEvents.eventId': event.eventId },
      { $pull: { pendingEvents: { eventId: event.eventId } } },
    );
  }
}

async function flushRideEventOutbox() {
  const rides = await Ride.find({ 'pendingEvents.0': { $exists: true } })
    .select('rideId +pendingEvents')
    .limit(100)
    .lean();

  for (const ride of rides) {
    try {
      await publishPendingRideEvents(ride.rideId);
    } catch (error) {
      console.error(
        `${ride.rideId}: ride event publication deferred (${error.code || error.name || 'error'})`,
      );
    }
  }
}

module.exports = {
  createRideStatusEvent,
  flushRideEventOutbox,
  publishPendingRideEvents,
};
