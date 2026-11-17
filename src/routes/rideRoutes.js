const express = require('express');
const { createRide, getRide } = require('../controllers/rideController');

const router = express.Router();

router.post('/rides', createRide);
router.get('/rides/:rideId', getRide);

module.exports = router;
