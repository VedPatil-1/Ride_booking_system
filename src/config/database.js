const mongoose = require('mongoose');
const { mongoUri } = require('./env');

async function connectMongo() {
  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw error;
  }
}

module.exports = { connectMongo };
