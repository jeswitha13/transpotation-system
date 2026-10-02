const express = require('express');
const router = express.Router();
const feeController = require('../controllers/feeController');
const paymentController = require('../controllers/paymentController');
const passController = require('../controllers/passController');
const notificationController = require('../controllers/notificationController');

// 1. Bus Fee Structure
router.get('/fees', feeController.getAllFeeStructures);
router.post('/fees', feeController.createFeeStructure);
router.put('/fees/:id', feeController.updateFeeStructure);
router.delete('/fees/:id', feeController.deleteFeeStructure);

// 2. Student Fee Records & Paid/Pending Status
router.get('/student-lookup/:query', feeController.lookupStudent);
router.get('/student-fees', feeController.getAllStudentFeeRecords);
router.post('/student-fees', feeController.createStudentFeeRecord);
router.put('/student-fees/:id', feeController.updateStudentFeeRecord);
router.delete('/student-fees/:id', feeController.deleteStudentFeeRecord);
router.get('/paid-pending', feeController.getAllStudentFeeRecords);

// 3. Payment Processing & History
router.get('/payments', paymentController.getAllPayments);
router.post('/payments', feeController.adminProcessPayment);
router.post('/process-payment', feeController.adminProcessPayment);

// 4. Receipts
router.get('/receipts', feeController.getAllReceipts);
router.post('/receipts', feeController.adminGenerateReceipt);
router.post('/generate-receipt', feeController.adminGenerateReceipt);

// 5. Late Fees / Fines
router.get('/late-fees', feeController.getAllLateFees);
router.post('/late-fees', feeController.applyLateFee);
router.put('/late-fees/:id', feeController.updateLateFee);
router.delete('/late-fees/:id', feeController.deleteLateFee);

// 6. Bus Pass Requests (Admin Review)
router.get('/bus-pass-requests', passController.getApplications);
router.put('/bus-pass-requests/:id/approve', passController.approveApplication);
router.put('/bus-pass-requests/:id/reject', passController.rejectApplication);

// 7. Notifications
router.get('/notifications', notificationController.getNotifications);

module.exports = router;
