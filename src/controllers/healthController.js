const mongoose = require('mongoose');
const { redisClient } = require('../config/redis');

function getHealth(_request, response) {
  const mongoConnected = mongoose.connection.readyState === 1;
  const redisConnected = redisClient.isOpen && redisClient.isReady;
  const healthy = mongoConnected && redisConnected;

  response.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'unavailable',
    services: {
      mongodb: mongoConnected ? 'connected' : 'disconnected',
      redis: redisConnected ? 'connected' : 'disconnected',
    },
  });
}

module.exports = { getHealth };
