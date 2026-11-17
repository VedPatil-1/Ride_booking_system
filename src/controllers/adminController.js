const { getDrivers, getEvents, getOverview, getRides, getSystemHealth, STATUSES } = require('../services/adminDashboard');

function positiveInteger(value, fallback, maximum) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

async function overview(request, response, next) {
  const days = positiveInteger(request.query.days, 7, 90);
  if (!days) return response.status(400).json({ error: 'days must be an integer from 1 to 90' });
  try {
    return response.json(await getOverview(days));
  } catch (error) { return next(error); }
}

async function rides(request, response, next) {
  const status = request.query.status;
  if (status && status !== 'ALL' && !STATUSES.includes(status)) {
    return response.status(400).json({ error: 'Invalid ride status filter' });
  }
  const page = positiveInteger(request.query.page, 1, 1_000_000);
  const limit = positiveInteger(request.query.limit, 25, 100);
  if (!page || !limit) return response.status(400).json({ error: 'page or limit is out of range' });
  const search = typeof request.query.search === 'string' ? request.query.search.trim().slice(0, 100) : '';
  try {
    return response.json(await getRides({ status, search, page, limit }));
  } catch (error) { return next(error); }
}

async function drivers(_request, response, next) {
  try { return response.json(await getDrivers()); } catch (error) { return next(error); }
}

async function events(request, response, next) {
  const limit = positiveInteger(request.query.limit, 50, 200);
  if (!limit) return response.status(400).json({ error: 'limit must be an integer from 1 to 200' });
  const rideId = typeof request.query.rideId === 'string' ? request.query.rideId.trim().slice(0, 100) : '';
  try {
    return response.json(await getEvents({ limit, rideId }));
  } catch (error) { return next(error); }
}

async function health(_request, response, next) {
  try { return response.json(await getSystemHealth()); } catch (error) { return next(error); }
}

module.exports = { drivers, events, health, overview, rides };
