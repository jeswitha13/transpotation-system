const express = require('express');
const router = express.Router();
const feeController = require('../controllers/feeController');

// Bus Fee Structure
router.get('/', feeController.getAllFeeStructures);
router.post('/', feeController.createFeeStructure);
router.get('/structures', feeController.getAllFeeStructures);
router.get('/structure/:id', feeController.getFeeStructureById);
router.put('/:id', feeController.updateFeeStructure);
router.put('/structure/:id', feeController.updateFeeStructure);
router.delete('/:id', feeController.deleteFeeStructure);
router.delete('/structure/:id', feeController.deleteFeeStructure);

// Student Lookup & Student Fee Records
router.get('/lookup/:query', feeController.lookupStudent);
router.get('/student-lookup/:query', feeController.lookupStudent);
router.get('/student/:studentId', feeController.getStudentFeeDetails);
router.get('/records', feeController.getAllStudentFeeRecords);
router.get('/student-fees', feeController.getAllStudentFeeRecords);
router.post('/records', feeController.createStudentFeeRecord);
router.post('/student-fees', feeController.createStudentFeeRecord);
router.put('/records/:id', feeController.updateStudentFeeRecord);
router.put('/student-fees/:id', feeController.updateStudentFeeRecord);
router.delete('/records/:id', feeController.deleteStudentFeeRecord);
router.delete('/student-fees/:id', feeController.deleteStudentFeeRecord);

// Payment Processing & Receipts
router.post('/process-payment', feeController.adminProcessPayment);
router.post('/payment', feeController.adminProcessPayment);
router.post('/generate-receipt', feeController.adminGenerateReceipt);
router.get('/receipts', feeController.getAllReceipts);

// Late Fees
router.get('/late-fees', feeController.getAllLateFees);
router.get('/late-fee', feeController.getAllLateFees);
router.post('/late-fees', feeController.applyLateFee);
router.post('/late-fee', feeController.applyLateFee);
router.put('/late-fees/:id', feeController.updateLateFee);
router.delete('/late-fees/:id', feeController.deleteLateFee);

module.exports = router;
