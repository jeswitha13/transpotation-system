const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const mapsController = require('../controllers/mapsController');

router.get('/', routeController.getAllRoutes);
router.post('/', routeController.createRoute);
router.get('/:id', routeController.getRouteById);
router.put('/:id', routeController.updateRoute);
router.delete('/:id', routeController.deleteRoute);

// Distance calculation endpoint
router.post('/calculate-distance', mapsController.calculateRouteDistance);

module.exports = router;
