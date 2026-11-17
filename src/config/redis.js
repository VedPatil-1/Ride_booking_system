const { createClient } = require('redis');
const { redisUrl } = require('./env');

function errorCode(error) {
  return error.code || error.name || 'unknown error';
}

function createRedisClient(label = 'Redis') {
  const client = createClient({ url: redisUrl });
  client.on('error', (error) => {
    console.error(`${label} client error (${errorCode(error)})`);
  });
  return client;
}

const redisClient = createRedisClient();

async function connectRedis() {
  try {
    await redisClient.connect();
    console.log('Redis connected');
  } catch (error) {
    console.error(`Redis connection failed (${errorCode(error)})`);
    throw error;
  }
}

module.exports = { connectRedis, createRedisClient, redisClient };
