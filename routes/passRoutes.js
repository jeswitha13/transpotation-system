const express = require('express');
const router = express.Router();
const passController = require('../controllers/passController');

router.get('/', passController.getAllPasses);
router.post('/apply', passController.applyBusPass);
router.get('/applications', passController.getApplications);
router.put('/:id/approve', passController.approveApplication);
router.put('/applications/:id/approve', passController.approveApplication);
router.put('/:id/reject', passController.rejectApplication);
router.put('/applications/:id/reject', passController.rejectApplication);

router.get('/student/:studentId', passController.getStudentPass);
router.post('/validate', passController.validatePass);

module.exports = router;

