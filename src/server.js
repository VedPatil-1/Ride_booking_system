const app = require('./app');
const { port } = require('./config/env');
const { connectMongo } = require('./config/database');
const { connectRedis, redisClient } = require('./config/redis');
const mongoose = require('mongoose');

async function startServer() {
  try {
    await Promise.all([connectMongo(), connectRedis()]);

    const server = app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });

    const shutdown = (signal) => {
      console.log(`${signal} received; shutting down`);
      server.close(async (error) => {
        if (error) {
          console.error('HTTP server shutdown failed:', error.message);
          process.exitCode = 1;
        }

        try {
          await Promise.all([mongoose.disconnect(), redisClient.quit()]);
          console.log('Database connections closed');
        } catch (shutdownError) {
          console.error('Connection shutdown failed:', shutdownError.message);
          process.exitCode = 1;
        }
      });
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Application startup failed:', error.message);
    await Promise.allSettled([mongoose.disconnect(), redisClient.quit()]);
    process.exitCode = 1;
  }
}

startServer();
