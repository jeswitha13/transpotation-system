const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');

router.post('/location', trackingController.updateLocation);
router.get('/student/:studentId', trackingController.getStudentAssignedBusLocation);
router.get('/buses', trackingController.getAllLiveBuses);
router.post('/trip/start', trackingController.startTrip);
router.post('/trip/end', trackingController.endTrip);
router.post('/status', trackingController.updateDriverTripStatus);
router.post('/:busId/status', trackingController.updateDriverTripStatus);
router.get('/:busId', trackingController.getBusTelemetryById);

module.exports = router;
