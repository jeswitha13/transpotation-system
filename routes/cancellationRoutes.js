const express = require('express');
const router = express.Router();
const cancellationController = require('../controllers/cancellationController');

router.get('/', cancellationController.getAllCancellations);
router.post('/', cancellationController.requestCancellation);
router.post('/submit', cancellationController.requestCancellation);
router.get('/student/:studentId', cancellationController.getStudentCancellation);
router.put('/:id/approve', cancellationController.approveCancellation);
router.put('/:id/reject', cancellationController.rejectCancellation);

module.exports = router;
