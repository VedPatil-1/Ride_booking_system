const mongoose = require('mongoose');

const RIDE_STATUSES = ['REQUESTED', 'ASSIGNED', 'NO_DRIVER_FOUND', 'ASSIGNMENT_FAILED'];
const pendingOfferSchema = new mongoose.Schema({
  driverId: { type: String, required: true },
  response: { type: String, enum: ['ACCEPTED', 'REJECTED', null], default: null },
}, { _id: false });

const rideEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true },
  eventType: { type: String, required: true },
  rideId: { type: String, required: true },
  riderId: { type: String, required: true },
  pickup: { type: String, required: true },
  destination: { type: String, required: true },
  status: { type: String, enum: ['REQUESTED', 'ASSIGNED', 'NO_DRIVER_FOUND'], required: true },
  timestamp: { type: String, required: true },
}, { _id: false });

const rideSchema = new mongoose.Schema({
  rideId: { type: String, required: true, unique: true, index: true },
  riderId: { type: String, required: true, trim: true },
  pickup: { type: String, required: true, trim: true },
  destination: { type: String, required: true, trim: true },
  status: { type: String, enum: RIDE_STATUSES, default: 'REQUESTED', required: true },
  assignedDriver: { type: String, default: null },
  rejectedDrivers: { type: [String], default: [] },
  testForceRejections: { type: Boolean, default: false, select: false },
  testWorkerFailuresRemaining: { type: Number, default: 0, min: 0, select: false },
  pendingEvents: { type: [rideEventSchema], default: [], select: false },
  pendingOffer: { type: pendingOfferSchema, default: null },
  recoveryAttempts: { type: Number, default: 0, min: 0 },
  recoveryLockUntil: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);
module.exports.RIDE_STATUSES = RIDE_STATUSES;
