const express = require('express');
const router = express.Router();
const mapsController = require('../controllers/mapsController');

router.get('/config', mapsController.getMapsConfig);
router.post('/calculate-distance', mapsController.calculateRouteDistance);

module.exports = router;
