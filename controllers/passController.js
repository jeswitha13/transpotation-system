const db = require('../config/db');

/**
 * 1. Student applies for Bus Pass
 * Backend automatically retrieves Student ID, Roll Number, Name, Course, Bus, Route, Pickup from DB.
 * Validates: transportation approved, fee paid, not cancelled, no active bus pass already exists!
 */
exports.applyBusPass = async (req, res) => {
  const connection = await db.getConnection();
  try {
    let studentId = req.body.studentId || req.body.student_id;
    if (req.user && req.user.role === 'student' && req.user.studentId) {
      studentId = req.user.studentId;
    }

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student identification required.' });
    }

    // Look up student from DB
    const [students] = await connection.query(
      `SELECT s.*, r.route_number, r.route_name, b.bus_number, l.name AS pickup_name
       FROM students s
       LEFT JOIN routes r ON s.assigned_route_id = r.id
       LEFT JOIN buses b ON s.assigned_bus_id = b.id
       LEFT JOIN locations l ON s.pickup_location_id = l.id
       WHERE s.id = ?`,
      [studentId]
    );

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found in database.' });
    }
    const student = students[0];

    // Requirement 31 Validation 1: Student is cancelled from transportation
    if (student.transportation_status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot apply for bus pass: Your transportation status is CANCELLED.'
      });
    }

    // Requirement 31 Validation 2: Assigned Route and Bus required
    if (!student.assigned_route_id || !student.assigned_bus_id || !student.pickup_location_id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot apply for bus pass: Transit route, bus, or pickup stop has not been assigned yet.'
      });
    }

    // Requirement 31 Validation 3: Check if another active bus pass already exists
    const [existingActivePasses] = await connection.query(
      'SELECT id, pass_number FROM bus_passes WHERE student_id = ? AND status = "ACTIVE"',
      [student.id]
    );
    if (existingActivePasses.length > 0) {
      return res.status(400).json({
        success: false,
        message: `An active bus pass (${existingActivePasses[0].pass_number}) already exists for this student.`
      });
    }

    // Check if an application is already pending
    const [pendingApps] = await connection.query(
      'SELECT id FROM bus_pass_applications WHERE student_id = ? AND status = "PENDING"',
      [student.id]
    );
    if (pendingApps.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You already have a bus pass application pending review by the Transport Office.'
      });
    }

    // Requirement 31 Validation 4: Required fee must be paid!
    const [feeRecords] = await connection.query(
      'SELECT * FROM student_fee_records WHERE student_id = ? ORDER BY id DESC LIMIT 1',
      [student.id]
    );

    if (feeRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot apply for bus pass: No fee record found. Please pay your transportation fee first.'
      });
    }

    const feeRec = feeRecords[0];
    if (feeRec.payment_status === 'UNPAID' || parseFloat(feeRec.paid_amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot apply for bus pass: Required transportation fee has not been paid.'
      });
    }

    // Find the successful payment ID
    const [payments] = await connection.query(
      'SELECT payment_id FROM payments WHERE student_id = ? AND payment_status = "SUCCESSFUL" ORDER BY payment_id DESC LIMIT 1',
      [student.id]
    );
    const paymentId = payments.length > 0 ? payments[0].payment_id : null;

    const reason = req.body.reason || req.body.remarks || 'Regular daily campus transit commute';

    await connection.beginTransaction();

    // Create Bus Pass Application with status PENDING and reason
    const [appResult] = await connection.query(
      `INSERT INTO bus_pass_applications (
        student_id, roll_number, route_id, bus_id, pickup_location_id, fee_payment_id, status, reason, applied_date
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, NOW())`,
      [student.id, student.roll_number, student.assigned_route_id, student.assigned_bus_id, student.pickup_location_id, paymentId, reason]
    );

    const applicationId = appResult.insertId;

    // Create Admin Notification
    await connection.query(
      `INSERT INTO notifications (user_id, target_role, title, message, category)
       VALUES (NULL, 'admin', 'Bus Pass Application Received', ?, 'info')`,
      [`Student ${student.name} (${student.roll_number}) applied for a Bus Pass on ${student.route_number || 'Assigned Route'}.`]
    );

    // Create Student Notification
    if (student.user_id) {
      await connection.query(
        `INSERT INTO notifications (user_id, target_role, title, message, category)
         VALUES (?, 'student', 'Bus Pass Application Submitted', 'Your digital bus pass application has been submitted and is currently PENDING Transport Office approval.', 'info')`,
        [student.user_id]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Bus Pass application submitted successfully.',
      applicationId
    });
  } catch (err) {
    await connection.rollback();
    console.error('applyBusPass error:', err);
    res.status(500).json({ success: false, message: 'Server error submitting bus pass application.', error: err.message });
  } finally {
    connection.release();
  }
};

/**
 * 2. Admin: Get Bus Pass Applications (with Pending, Approved, Rejected filters)
 */
exports.getApplications = async (req, res) => {
  try {
    const { status, search } = req.query;

    let query = `
      SELECT bpa.*,
             s.name AS student_name, s.course, s.phone AS student_phone, s.email AS student_email,
             r.route_number, r.route_name,
             b.bus_number, b.registration_number,
             l.name AS pickup_location_name,
             sfr.payment_status AS fee_payment_status, sfr.paid_amount, sfr.total_fee,
             p.transaction_id, rc.receipt_number
      FROM bus_pass_applications bpa
      JOIN students s ON bpa.student_id = s.id
      JOIN routes r ON bpa.route_id = r.id
      JOIN buses b ON bpa.bus_id = b.id
      JOIN locations l ON bpa.pickup_location_id = l.id
      LEFT JOIN student_fee_records sfr ON s.id = sfr.student_id AND sfr.academic_year = '2026-27'
      LEFT JOIN payments p ON bpa.fee_payment_id = p.payment_id
      LEFT JOIN receipts rc ON p.payment_id = rc.payment_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND UPPER(bpa.status) = UPPER(?)`;
      params.push(status);
    }

    if (search) {
      const q = `%${search.trim().toLowerCase()}%`;
      query += ` AND (LOWER(s.name) LIKE ? OR LOWER(bpa.roll_number) LIKE ? OR LOWER(b.bus_number) LIKE ? OR LOWER(r.route_number) LIKE ?)`;
      params.push(q, q, q, q);
    }

    query += ` ORDER BY bpa.id DESC`;

    const [rows] = await db.query(query, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('getApplications error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving bus pass applications.', error: err.message });
  }
};

/**
 * 3. Admin: Approve Bus Pass Application
 * Application: APPROVED -> Create Bus Pass -> Status: ACTIVE -> Student Notification
 */
exports.approveApplication = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params; // application_id
    const adminUserId = req.user ? req.user.id : null;

    const [apps] = await connection.query(
      `SELECT bpa.*, s.name AS student_name, s.user_id, s.roll_number, b.bus_number, r.route_number, l.name AS pickup_name
       FROM bus_pass_applications bpa
       JOIN students s ON bpa.student_id = s.id
       JOIN buses b ON bpa.bus_id = b.id
       JOIN routes r ON bpa.route_id = r.id
       JOIN locations l ON bpa.pickup_location_id = l.id
       WHERE bpa.id = ?`,
      [id]
    );

    if (apps.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const app = apps[0];

    if (app.status === 'APPROVED') {
      return res.status(400).json({ success: false, message: 'Application is already approved.' });
    }

    await connection.beginTransaction();

    // 1. Mark application APPROVED
    await connection.query(
      `UPDATE bus_pass_applications SET
        status = 'APPROVED',
        reviewed_by_admin_id = ?,
        reviewed_at = NOW()
       WHERE id = ?`,
      [adminUserId, id]
    );

    // 2. Generate unique Bus Pass Number
    const passNumber = `PASS-2627-${app.roll_number}`;
    const qrData = `TRANSIT-PASS-VERIFIED|ROLL:${app.roll_number}|BUS:${app.bus_number}|ROUTE:${app.route_number}|AY:2026-27|VALID:2027-05-31`;

    // 3. Create Bus Pass with status ACTIVE
    const [passResult] = await connection.query(
      `INSERT INTO bus_passes (
        application_id, pass_number, student_id, bus_id, route_id, pickup_location_id,
        valid_from, valid_until, academic_year, status, qr_data, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR), '2026-27', 'ACTIVE', ?, NOW())
      ON DUPLICATE KEY UPDATE status = 'ACTIVE', valid_until = DATE_ADD(CURDATE(), INTERVAL 1 YEAR), qr_data = VALUES(qr_data)`,
      [app.id, passNumber, app.student_id, app.bus_id, app.route_id, app.pickup_location_id, qrData]
    );

    // 4. Update student transportation status to 'active'
    await connection.query(
      `UPDATE students SET transportation_status = 'active' WHERE id = ?`,
      [app.student_id]
    );

    // 5. Notify student
    if (app.user_id) {
      await connection.query(
        `INSERT INTO notifications (user_id, target_role, title, message, category)
         VALUES (?, 'student', 'Bus Pass Approved! 🎫', ?, 'success')`,
        [
          app.user_id,
          `Congratulations! Your Digital Bus Pass (${passNumber}) for ${app.route_number} has been APPROVED and is now ACTIVE.`
        ]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Bus Pass approved successfully.',
      passNumber
    });
  } catch (err) {
    await connection.rollback();
    console.error('approveApplication error:', err);
    res.status(500).json({ success: false, message: 'Server error approving bus pass.', error: err.message });
  } finally {
    connection.release();
  }
};

/**
 * 4. Admin: Reject Bus Pass Application
 */
exports.rejectApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminUserId = req.user ? req.user.id : null;

    const [apps] = await db.query(
      `SELECT bpa.*, s.user_id, s.name AS student_name, s.roll_number
       FROM bus_pass_applications bpa
       JOIN students s ON bpa.student_id = s.id
       WHERE bpa.id = ?`,
      [id]
    );

    if (apps.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    const app = apps[0];

    const rejectReason = reason || 'Incomplete fee verification or documentation criteria not met.';

    await db.query(
      `UPDATE bus_pass_applications SET
        status = 'REJECTED',
        rejection_reason = ?,
        reviewed_by_admin_id = ?,
        reviewed_at = NOW()
       WHERE id = ?`,
      [rejectReason, adminUserId, id]
    );

    // Notify student
    if (app.user_id) {
      await db.query(
        `INSERT INTO notifications (user_id, target_role, title, message, category)
         VALUES (?, 'student', 'Bus Pass Application Rejected', ?, 'danger')`,
        [
          app.user_id,
          `Your bus pass application was rejected by the Transport Office. Reason: ${rejectReason}`
        ]
      );
    }

    res.json({ success: true, message: 'Bus Pass application rejected.' });
  } catch (err) {
    console.error('rejectApplication error:', err);
    res.status(500).json({ success: false, message: 'Server error rejecting bus pass application.', error: err.message });
  }
};

/**
 * 5. Get Student's Active Bus Pass for Student Dashboard
 */
exports.getStudentPass = async (req, res) => {
  try {
    const { studentId } = req.params;

    let [students] = await db.query('SELECT id, user_id FROM students WHERE id = ? LIMIT 1', [studentId]);
    if (students.length === 0) {
      [students] = await db.query('SELECT id, user_id FROM students WHERE user_id = ? OR UPPER(roll_number) = UPPER(?) LIMIT 1', [studentId, studentId]);
    }

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    const realStudentId = students[0].id;

    const [passes] = await db.query(`
      SELECT bp.*,
             s.name AS student_name, s.roll_number, s.course, s.year_of_study, s.phone, s.email, s.parent_name,
             b.bus_number, b.registration_number,
             r.route_number, r.route_name,
             l.name AS pickup_location_name,
             d.name AS driver_name, d.phone AS driver_phone
      FROM bus_passes bp
      JOIN students s ON bp.student_id = s.id
      LEFT JOIN buses b ON bp.bus_id = b.id
      LEFT JOIN routes r ON bp.route_id = r.id
      LEFT JOIN locations l ON bp.pickup_location_id = l.id
      LEFT JOIN drivers d ON (d.assigned_bus_id = b.id OR r.driver_id = d.id)
      WHERE bp.student_id = ?
      ORDER BY bp.id DESC LIMIT 1
    `, [realStudentId]);

    if (passes.length === 0) {
      // Check if there is an application pending
      const [pending] = await db.query(
        'SELECT status, rejection_reason, applied_date FROM bus_pass_applications WHERE student_id = ? ORDER BY id DESC LIMIT 1',
        [realStudentId]
      );

      return res.json({
        success: true,
        hasPass: false,
        applicationStatus: pending.length > 0 ? pending[0].status : 'NOT_APPLIED',
        rejectionReason: pending.length > 0 ? pending[0].rejection_reason : null,
        data: null
      });
    }

    res.json({
      success: true,
      hasPass: true,
      data: passes[0]
    });
  } catch (err) {
    console.error('getStudentPass error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving bus pass.', error: err.message });
  }
};

/**
 * 6. Admin: Get all issued bus passes
 */
exports.getAllPasses = async (req, res) => {
  try {
    const { status, search } = req.query;

    let query = `
      SELECT bp.*,
             s.name AS student_name, s.roll_number, s.course, s.phone,
             b.bus_number, b.registration_number,
             r.route_number, r.route_name,
             l.name AS pickup_location_name
      FROM bus_passes bp
      JOIN students s ON bp.student_id = s.id
      JOIN buses b ON bp.bus_id = b.id
      JOIN routes r ON bp.route_id = r.id
      JOIN locations l ON bp.pickup_location_id = l.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND UPPER(bp.status) = UPPER(?)`;
      params.push(status);
    }

    if (search) {
      const q = `%${search.trim().toLowerCase()}%`;
      query += ` AND (LOWER(s.name) LIKE ? OR LOWER(bp.roll_number) LIKE ? OR LOWER(bp.pass_number) LIKE ? OR LOWER(b.bus_number) LIKE ?)`;
      params.push(q, q, q, q);
    }

    query += ` ORDER BY bp.id DESC`;

    const [rows] = await db.query(query, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('getAllPasses error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving passes.', error: err.message });
  }
};

/**
 * 7. Validate Pass for Driver Scanner or Verification
 */
exports.validatePass = async (req, res) => {
  try {
    const { code, rollNumber, passNumber } = req.body;
    const queryTerm = (code || rollNumber || passNumber || '').trim();

    if (!queryTerm) {
      return res.status(400).json({ valid: false, message: 'Please enter a Roll Number or Pass Code.' });
    }

    // Try finding active pass
    const [passes] = await db.query(`
      SELECT bp.*,
             s.name AS student_name, s.roll_number, s.course, s.phone,
             b.bus_number, b.registration_number,
             r.route_number, r.route_name,
             l.name AS pickup_location_name
      FROM bus_passes bp
      JOIN students s ON bp.student_id = s.id
      JOIN buses b ON bp.bus_id = b.id
      JOIN routes r ON bp.route_id = r.id
      JOIN locations l ON bp.pickup_location_id = l.id
      WHERE bp.pass_number = ? OR bp.qr_data = ? OR UPPER(s.roll_number) = UPPER(?)
      ORDER BY bp.id DESC LIMIT 1
    `, [queryTerm, queryTerm, queryTerm]);

    if (passes.length > 0) {
      const pass = passes[0];

      if (pass.status === 'ACTIVE') {
        const today = new Date().toISOString().split('T')[0];
        const validUntil = new Date(pass.valid_until).toISOString().split('T')[0];

        if (validUntil >= today) {
          return res.json({
            valid: true,
            status: 'ACTIVE',
            message: 'Bus Pass verified and ACTIVE.',
            data: {
              passNumber: pass.pass_number,
              studentName: pass.student_name,
              rollNo: pass.roll_number,
              course: pass.course,
              busNumber: pass.bus_number,
              routeName: `${pass.route_number} - ${pass.route_name}`,
              pickupLocation: pass.pickup_location_name,
              validUntil: new Date(pass.valid_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
              status: pass.status
            }
          });
        } else {
          return res.json({
            valid: false,
            status: 'EXPIRED',
            reason: 'Bus Pass Expired',
            message: `Bus Pass expired on ${validUntil}. Please renew.`
          });
        }
      } else {
        return res.json({
          valid: false,
          status: pass.status,
          reason: `Pass ${pass.status}`,
          message: `Bus Pass status is currently ${pass.status}. Boarding not permitted.`
        });
      }
    }

    // Pass not found: check student to provide clear feedback
    const [students] = await db.query(
      'SELECT id, name, roll_number, transportation_status FROM students WHERE UPPER(roll_number) = UPPER(?)',
      [queryTerm]
    );

    if (students.length > 0) {
      const stu = students[0];
      return res.json({
        valid: false,
        status: 'NO_ACTIVE_PASS',
        reason: 'No Active Pass',
        message: `Student ${stu.name} (${stu.roll_number}) does not have an approved active bus pass. Transportation status: ${stu.transportation_status || 'Unregistered'}.`
      });
    }

    return res.json({
      valid: false,
      status: 'NOT_FOUND',
      reason: 'Record Not Found',
      message: 'No student or bus pass record matches the scanned code/roll number.'
    });
  } catch (err) {
    console.error('validatePass error:', err);
    res.status(500).json({ valid: false, message: 'Server error validating bus pass.', error: err.message });
  }
};

