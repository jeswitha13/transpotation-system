const db = require('../config/db');

/**
 * 1. Student submits Cancellation Request
 */
exports.requestCancellation = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { studentId, student_id, reason, remarks } = req.body;

    let effectiveStudentId = studentId || student_id;
    if (req.user && req.user.role === 'student' && req.user.studentId) {
      effectiveStudentId = req.user.studentId;
    }

    if (!effectiveStudentId) {
      return res.status(400).json({ success: false, message: 'Student ID required.' });
    }

    const validReasons = [
      'Using Own Vehicle',
      'Shifted Residence',
      'No Longer Requires Bus',
      'Personal Reason',
      'Other'
    ];

    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: `Please select a valid reason: ${validReasons.join(', ')}.`
      });
    }

    const [students] = await connection.query('SELECT * FROM students WHERE id = ?', [effectiveStudentId]);
    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    const student = students[0];

    // Check for existing pending request
    const [pending] = await connection.query(
      'SELECT id FROM cancellation_requests WHERE student_id = ? AND status = "PENDING"',
      [student.id]
    );
    if (pending.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A cancellation request is already pending review with the Transport Office.'
      });
    }

    await connection.beginTransaction();

    const [reqRes] = await connection.query(
      `INSERT INTO cancellation_requests (student_id, reason, remarks, status)
       VALUES (?, ?, ?, 'PENDING')`,
      [student.id, reason, remarks || '']
    );

    // Create Admin notification
    await connection.query(
      `INSERT INTO notifications (user_id, target_role, title, message, category)
       VALUES (NULL, 'admin', 'Cancellation Request Received', ?, 'warning')`,
      [`Student ${student.name} (${student.roll_number}) requested transportation cancellation. Reason: ${reason}.`]
    );

    // Create Student confirmation
    if (student.user_id) {
      await connection.query(
        `INSERT INTO notifications (user_id, target_role, title, message, category)
         VALUES (?, 'student', 'Cancellation Request Submitted', 'Your commute cancellation request was submitted and is pending Transport Director review.', 'info')`,
        [student.user_id]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Transportation cancellation request submitted successfully.',
      requestId: reqRes.insertId
    });
  } catch (err) {
    await connection.rollback();
    console.error('requestCancellation error:', err);
    res.status(500).json({ success: false, message: 'Server error submitting cancellation request.', error: err.message });
  } finally {
    connection.release();
  }
};

/**
 * 2. Admin: Get all cancellation requests
 */
exports.getAllCancellations = async (req, res) => {
  try {
    const { status } = req.query;

    let query = `
      SELECT cr.*,
             s.name AS student_name, s.roll_number, s.course, s.phone,
             r.route_number, r.route_name,
             b.bus_number,
             l.name AS pickup_location_name
      FROM cancellation_requests cr
      JOIN students s ON cr.student_id = s.id
      LEFT JOIN routes r ON s.assigned_route_id = r.id
      LEFT JOIN buses b ON s.assigned_bus_id = b.id
      LEFT JOIN locations l ON s.pickup_location_id = l.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND UPPER(cr.status) = UPPER(?)`;
      params.push(status);
    }

    query += ` ORDER BY cr.id DESC`;

    const [rows] = await db.query(query, params);

    const formatted = rows.map(r => ({
      id: r.id,
      studentId: r.student_id,
      studentName: r.student_name,
      rollNo: r.roll_number,
      course: r.course,
      phone: r.phone,
      route: r.route_number ? `${r.route_number} - ${r.route_name}` : 'Unassigned',
      busNumber: r.bus_number || 'Unassigned',
      pickupLocation: r.pickup_location_name || 'Unassigned',
      reason: r.reason,
      remarks: r.remarks,
      status: r.status,
      adminRemarks: r.admin_remarks,
      requestDate: r.created_at
    }));

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    console.error('getAllCancellations error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving cancellation requests.', error: err.message });
  }
};

/**
 * 3. Admin: Approve Cancellation Request
 * If approved:
 * - Transportation Status = CANCELLED
 * - Active bus assignment removed
 * - Active bus pass cancelled
 * - Historical payments, receipts, previous transactions remain in database!
 */
exports.approveCancellation = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const { adminRemarks } = req.body;
    const adminUserId = req.user ? req.user.id : null;

    const [reqs] = await connection.query(
      `SELECT cr.*, s.user_id, s.name AS student_name, s.roll_number
       FROM cancellation_requests cr
       JOIN students s ON cr.student_id = s.id
       WHERE cr.id = ?`,
      [id]
    );

    if (reqs.length === 0) {
      return res.status(404).json({ success: false, message: 'Cancellation request not found.' });
    }
    const cr = reqs[0];

    await connection.beginTransaction();

    // 1. Mark cancellation request as APPROVED
    await connection.query(
      `UPDATE cancellation_requests SET
        status = 'APPROVED',
        admin_remarks = ?,
        reviewed_by_admin_id = ?,
        reviewed_at = NOW()
       WHERE id = ?`,
      [adminRemarks || 'Approved by Transport Director', adminUserId, id]
    );

    // 2. Set student transportation status to CANCELLED and remove active bus assignment
    await connection.query(
      `UPDATE students SET
        transportation_status = 'cancelled',
        assigned_bus_id = NULL
       WHERE id = ?`,
      [cr.student_id]
    );

    // 3. Mark active bus pass as CANCELLED (preserving pass record)
    await connection.query(
      `UPDATE bus_passes SET status = 'CANCELLED' WHERE student_id = ? AND status = 'ACTIVE'`,
      [cr.student_id]
    );

    // 4. Notify student
    if (cr.user_id) {
      await connection.query(
        `INSERT INTO notifications (user_id, target_role, title, message, category)
         VALUES (?, 'student', 'Transportation Cancelled', 'Your commute cancellation request has been APPROVED by the Transport Office. Your bus pass has been revoked.', 'warning')`,
        [cr.user_id]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Cancellation request approved. Active transit pass cancelled while historical payments and records remain securely archived in database.'
    });
  } catch (err) {
    await connection.rollback();
    console.error('approveCancellation error:', err);
    res.status(500).json({ success: false, message: 'Server error approving cancellation.', error: err.message });
  } finally {
    connection.release();
  }
};

/**
 * 4. Admin: Reject Cancellation Request
 */
exports.rejectCancellation = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminRemarks } = req.body;
    const adminUserId = req.user ? req.user.id : null;

    const [reqs] = await db.query(
      `SELECT cr.*, s.user_id, s.name AS student_name
       FROM cancellation_requests cr
       JOIN students s ON cr.student_id = s.id
       WHERE cr.id = ?`,
      [id]
    );

    if (reqs.length === 0) {
      return res.status(404).json({ success: false, message: 'Cancellation request not found.' });
    }
    const cr = reqs[0];

    const remarks = adminRemarks || 'Cancellation request rejected by administration.';

    await db.query(
      `UPDATE cancellation_requests SET
        status = 'REJECTED',
        admin_remarks = ?,
        reviewed_by_admin_id = ?,
        reviewed_at = NOW()
       WHERE id = ?`,
      [remarks, adminUserId, id]
    );

    // Notify student
    if (cr.user_id) {
      await db.query(
        `INSERT INTO notifications (user_id, target_role, title, message, category)
         VALUES (?, 'student', 'Cancellation Request Rejected', ?, 'danger')`,
        [cr.user_id, `Your commute cancellation request was rejected. Remarks: ${remarks}`]
      );
    }

    res.json({ success: true, message: 'Cancellation request rejected.' });
  } catch (err) {
    console.error('rejectCancellation error:', err);
    res.status(500).json({ success: false, message: 'Server error rejecting cancellation.', error: err.message });
  }
};

/**
 * 5. Get Cancellation Requests for a Student
 */
exports.getStudentCancellation = async (req, res) => {
  try {
    const { studentId } = req.params;
    const [rows] = await db.query(
      `SELECT cr.*, s.name AS student_name, s.roll_number
       FROM cancellation_requests cr
       JOIN students s ON cr.student_id = s.id
       WHERE cr.student_id = ? OR s.user_id = ? OR UPPER(s.roll_number) = UPPER(?)
       ORDER BY cr.id DESC`,
      [studentId, studentId, studentId]
    );

    const formatted = rows.map(r => ({
      id: r.id,
      studentId: r.student_id,
      studentName: r.student_name,
      rollNo: r.roll_number,
      reason: r.reason,
      remarks: r.remarks,
      status: r.status,
      adminRemarks: r.admin_remarks || 'Awaiting Transport Office review',
      requestDate: r.created_at
    }));

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    console.error('getStudentCancellation error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving cancellation status.', error: err.message });
  }
};

