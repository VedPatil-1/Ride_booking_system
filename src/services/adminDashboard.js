const Ride = require('../models/Ride');
const mongoose = require('mongoose');
const { redisClient } = require('../config/redis');
const { DRIVERS } = require('./driverAssignment');
const { RIDE_EVENTS_STREAM } = require('../events/constants');
const { HEARTBEAT_PREFIX, HEARTBEAT_TTL_SECONDS } = require('./processHeartbeat');

const CONSUMER_GROUPS = ['billing-service', 'operations-service'];
const STATUSES = ['REQUESTED', 'ASSIGNED', 'NO_DRIVER_FOUND', 'ASSIGNMENT_FAILED'];

function dateDaysAgo(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

async function getOverview(days = 7) {
  const since = dateDaysAgo(days);
  const [counts, activity, recentRides] = await Promise.all([
    Ride.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Ride.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Ride.find().select('rideId riderId pickup destination status assignedDriver createdAt')
      .sort({ createdAt: -1 }).limit(8).lean(),
  ]);

  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  for (const row of counts) byStatus[row._id] = row.count;
  const activityByDay = new Map(activity.map((row) => [row._id, row.count]));
  const rideActivity = [];
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(since);
    day.setUTCDate(since.getUTCDate() + offset);
    const key = day.toISOString().slice(0, 10);
    rideActivity.push({ date: key, count: activityByDay.get(key) || 0 });
  }

  return {
    totals: {
      total: Object.values(byStatus).reduce((sum, value) => sum + value, 0),
      requested: byStatus.REQUESTED,
      assigned: byStatus.ASSIGNED,
      noDriverFound: byStatus.NO_DRIVER_FOUND,
      assignmentFailed: byStatus.ASSIGNMENT_FAILED,
    },
    statusDistribution: STATUSES.map((status) => ({ status, count: byStatus[status] })),
    rideActivity,
    recentRides,
    dataAsOf: new Date().toISOString(),
  };
}

async function getRides({ status, search, page, limit }) {
  const filter = {};
  if (status && status !== 'ALL') filter.status = status;
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(escaped, 'i');
    filter.$or = [
      { rideId: expression }, { riderId: expression }, { pickup: expression },
      { destination: expression }, { assignedDriver: expression },
    ];
  }
  const [rides, total] = await Promise.all([
    Ride.find(filter).select('rideId riderId pickup destination status assignedDriver createdAt updatedAt')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Ride.countDocuments(filter),
  ]);
  return { rides, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function getDrivers() {
  const rows = await Ride.aggregate([
    { $match: { status: 'ASSIGNED', assignedDriver: { $in: DRIVERS } } },
    { $sort: { updatedAt: -1 } },
    { $group: { _id: '$assignedDriver', rideId: { $first: '$rideId' }, updatedAt: { $first: '$updatedAt' } } },
  ]);
  const assigned = new Map(rows.map((row) => [row._id, row]));
  return {
    drivers: DRIVERS.map((driverId) => {
      const activeRide = assigned.get(driverId);
      return {
        driverId,
        assignmentRecordStatus: activeRide ? 'HAS_ASSIGNED_RIDE_RECORD' : 'NO_ASSIGNED_RIDE_RECORD',
        assignedRideId: activeRide?.rideId || null,
        derivedFrom: 'ride assignment records only; the backend has no driver availability or ride completion state',
      };
    }),
    dataAsOf: new Date().toISOString(),
  };
}

function flattenEvents(reply) {
  return (reply || []).flatMap((stream) => (stream.messages || []).map((entry) => ({
    streamId: entry.id,
    ...entry.message,
  })));
}

async function getEvents({ limit, rideId }) {
  const entries = await redisClient.xRevRange(RIDE_EVENTS_STREAM, '+', '-', { COUNT: limit });
  const events = flattenEvents([{ messages: entries }])
    .filter((event) => !rideId || event.rideId === rideId);
  const enriched = await Promise.all(events.map(async (event) => {
    const [billingProcessed, operationsProcessed] = await Promise.all(CONSUMER_GROUPS.map(
      (group) => redisClient.sIsMember(`${RIDE_EVENTS_STREAM}:processed:${group}`, event.eventId),
    ));
    return {
      eventId: event.eventId,
      eventType: event.eventType,
      rideId: event.rideId,
      status: event.status,
      timestamp: event.timestamp,
      billing: billingProcessed ? 'PROCESSED' : 'UNPROCESSED',
      operations: operationsProcessed ? 'PROCESSED' : 'UNPROCESSED',
    };
  }));
  return { events: enriched, dataAsOf: new Date().toISOString() };
}

async function getProcessHealth(client, processName) {
  try {
    const value = await client.get(`${HEARTBEAT_PREFIX}${processName}`);
    if (!value) return { status: 'unavailable', heartbeatAgeSeconds: null };
    const ageSeconds = Math.max(0, Math.floor((Date.now() - Number(value)) / 1000));
    return {
      status: ageSeconds < HEARTBEAT_TTL_SECONDS ? 'healthy' : 'unavailable',
      heartbeatAgeSeconds: ageSeconds,
    };
  } catch (_error) {
    return { status: 'unavailable', heartbeatAgeSeconds: null };
  }
}

async function getSystemHealth() {
  const mongo = mongoose.connection.readyState === 1;
  let redis = false;
  try {
    redis = redisClient.isOpen && redisClient.isReady && (await redisClient.ping()) === 'PONG';
  } catch (_error) {
    redis = false;
  }
  const [worker, billingSubscriber, operationsSubscriber] = await Promise.all([
    getProcessHealth(redisClient, 'assignment-worker'),
    getProcessHealth(redisClient, 'billing-subscriber'),
    getProcessHealth(redisClient, 'operations-subscriber'),
  ]);
  return {
    services: {
      api: { status: 'healthy', note: 'responding to this authenticated request' },
      mongodb: { status: mongo ? 'healthy' : 'unavailable' },
      redis: { status: redis ? 'healthy' : 'unavailable' },
      assignmentWorker: worker,
      billingSubscriber,
      operationsSubscriber,
    },
    dataAsOf: new Date().toISOString(),
  };
}

module.exports = { getDrivers, getEvents, getOverview, getRides, getSystemHealth, STATUSES };
