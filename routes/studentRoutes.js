const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

// Student Specific Dedicated Endpoints (Section 7 API Requirements)
router.post('/register', studentController.studentRegister);
router.post('/login', studentController.studentLogin);
router.get('/profile', studentController.getStudentProfile);
router.get('/bus', studentController.getStudentBus);
router.get('/route', studentController.getStudentRoute);
router.get('/fees', studentController.getStudentFees);
router.post('/payments', studentController.processStudentPayment);
router.get('/payments', studentController.getStudentPaymentHistory);
router.get('/receipts', studentController.getStudentReceiptsList);
router.post('/bus-pass', studentController.applyBusPassRequest);
router.get('/notifications', studentController.getStudentNotificationsList);

router.get('/', studentController.getAllStudents);
router.post('/', studentController.createStudent);
router.get('/:id', studentController.getStudentById);
router.put('/:id', studentController.updateStudent);
router.delete('/:id', studentController.deleteStudent);

module.exports = router;
