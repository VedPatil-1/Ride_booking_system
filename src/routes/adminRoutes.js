const express = require('express');
const { requireAdminKey } = require('../middleware/adminAuth');
const { drivers, events, health, overview, rides } = require('../controllers/adminController');

const router = express.Router();

router.use(requireAdminKey);
router.get('/overview', overview);
router.get('/rides', rides);
router.get('/drivers', drivers);
router.get('/events', events);
router.get('/health', health);

module.exports = router;
