const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.get('/:id', paymentController.getReceiptById);
router.get('/student/:studentId', paymentController.getStudentPayments);

module.exports = router;
