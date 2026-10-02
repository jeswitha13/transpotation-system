const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.get('/', paymentController.getAllPayments);
router.post('/', paymentController.processPayment);
router.post('/process', paymentController.processPayment);
router.get('/student/:studentId', paymentController.getStudentPayments);

router.post('/cash', paymentController.requestCashPayment);
router.post('/cash-request', paymentController.requestCashPayment);
router.put('/cash/:id/approve', paymentController.approveCashPayment);
router.put('/cash/:id/reject', paymentController.rejectCashPayment);

router.get('/receipt/:id', paymentController.getReceiptById);

module.exports = router;
