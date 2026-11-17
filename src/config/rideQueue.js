const { Queue } = require('bullmq');
const { redisUrl } = require('./env');

const RIDE_QUEUE_NAME = 'ride-assignment';
const url = new URL(redisUrl);
const connection = {
  host: url.hostname,
  port: Number(url.port || 6379),
  maxRetriesPerRequest: null,
};
if (url.password) connection.password = decodeURIComponent(url.password);
if (url.username) connection.username = decodeURIComponent(url.username);
if (url.pathname && url.pathname !== '/') connection.db = Number(url.pathname.slice(1));
if (url.protocol === 'rediss:') connection.tls = {};

const rideQueue = new Queue(RIDE_QUEUE_NAME, { connection });

module.exports = { RIDE_QUEUE_NAME, connection, rideQueue };
