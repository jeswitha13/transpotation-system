const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const { isValidRollNumber, generateReceiptNumber, generateTransactionId } = require('../utils/codeGenerators');
const { numberToWords } = require('../utils/numberToWords');

exports.getAllStudents = async (req, res) => {
  try {
    const { search, routeId, busId, feeStatus, status } = req.query;

    let query = `
      SELECT s.id, s.user_id, s.roll_number, s.name, s.course, s.admission_number, s.parent_name,
             s.year_of_study, s.phone, s.email, s.address, s.transportation_status,
             s.pickup_location_id, s.assigned_route_id, s.assigned_bus_id,
             l.name AS locationName, l.distance_km AS locationDistance,
             r.route_number AS routeNumber, r.route_name AS routeTitle, r.distance_km AS routeDistance,
             b.bus_number AS busNumber, b.registration_number AS busReg,
             sfr.total_fee, sfr.paid_amount, sfr.pending_amount, sfr.payment_status AS feeStatus,
             bp.status AS passStatus, bp.pass_number AS passId
      FROM students s
      LEFT JOIN locations l ON s.pickup_location_id = l.id
      LEFT JOIN routes r ON s.assigned_route_id = r.id
      LEFT JOIN buses b ON s.assigned_bus_id = b.id
      LEFT JOIN student_fee_records sfr ON s.id = sfr.student_id AND sfr.academic_year = '2026-27'
      LEFT JOIN bus_passes bp ON s.id = bp.student_id AND bp.status = 'ACTIVE'
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      const q = `%${search.trim().toLowerCase()}%`;
      query += ` AND (LOWER(s.name) LIKE ? OR LOWER(s.roll_number) LIKE ? OR LOWER(s.email) LIKE ? OR s.phone LIKE ? OR LOWER(s.admission_number) LIKE ?)`;
      params.push(q, q, q, q, q);
    }

    if (routeId) {
      query += ` AND s.assigned_route_id = ?`;
      params.push(routeId);
    }

    if (busId) {
      query += ` AND s.assigned_bus_id = ?`;
      params.push(busId);
    }

    if (feeStatus) {
      query += ` AND LOWER(sfr.payment_status) = LOWER(?)`;
      params.push(feeStatus);
    }

    if (status) {
      query += ` AND LOWER(s.transportation_status) = LOWER(?)`;
      params.push(status);
    }

    query += ` ORDER BY s.id DESC`;

    const [rows] = await db.query(query, params);

    const formatted = rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      rollNo: r.roll_number,
      rollNumber: r.roll_number,
      name: r.name,
      course: r.course,
      admissionNumber: r.admission_number || 'N/A',
      parentName: r.parent_name || 'N/A',
      year: r.year_of_study,
      phone: r.phone,
      email: r.email,
      address: r.address || '',
      pickupId: r.pickup_location_id,
      locationName: r.locationName || 'Unassigned',
      routeId: r.assigned_route_id,
      routeName: r.routeNumber ? `${r.routeNumber} - ${r.routeTitle}` : 'Unassigned',
      busId: r.assigned_bus_id,
      busNumber: r.busNumber || 'Unassigned',
      feeStatus: r.feeStatus || 'UNPAID',
      totalFee: r.total_fee || 0,
      paidAmount: r.paid_amount || 0,
      pendingAmount: r.pending_amount || 0,
      passStatus: r.passStatus || 'No Active Pass',
      passId: r.passId || null,
      status: r.transportation_status || 'pending'
    }));

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    console.error('getAllStudents error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving students.', error: err.message });
  }
};

exports.getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    // Search by student ID or roll number
    let [students] = await db.query(
      `SELECT s.*, 
              l.name AS location_name, l.zone AS location_zone, l.distance_km AS location_distance,
              r.route_number, r.route_name, r.distance_km AS route_distance,
              b.bus_number, b.registration_number,
              d.id AS driver_db_id, d.driver_id_code, d.name AS driver_name, d.phone AS driver_phone, d.license_number
       FROM students s
       LEFT JOIN locations l ON s.pickup_location_id = l.id
       LEFT JOIN routes r ON s.assigned_route_id = r.id
       LEFT JOIN buses b ON s.assigned_bus_id = b.id
       LEFT JOIN drivers d ON (d.assigned_bus_id = b.id OR r.driver_id = d.id)
       WHERE s.id = ?
       LIMIT 1`,
      [id]
    );

    if (students.length === 0) {
      [students] = await db.query(
        `SELECT s.*, 
                l.name AS location_name, l.zone AS location_zone, l.distance_km AS location_distance,
                r.route_number, r.route_name, r.distance_km AS route_distance,
                b.bus_number, b.registration_number,
                d.id AS driver_db_id, d.driver_id_code, d.name AS driver_name, d.phone AS driver_phone, d.license_number
         FROM students s
         LEFT JOIN locations l ON s.pickup_location_id = l.id
         LEFT JOIN routes r ON s.assigned_route_id = r.id
         LEFT JOIN buses b ON s.assigned_bus_id = b.id
         LEFT JOIN drivers d ON (d.assigned_bus_id = b.id OR r.driver_id = d.id)
         WHERE UPPER(s.roll_number) = UPPER(?)
         LIMIT 1`,
        [id]
      );
    }

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const s = students[0];

    // Fetch fee records
    const [feeRecords] = await db.query(
      `SELECT sfr.*, fs.fee_calculation_type, fs.fee_per_km, fs.fixed_route_fee
       FROM student_fee_records sfr
       LEFT JOIN fee_structures fs ON sfr.fee_structure_id = fs.id
       WHERE sfr.student_id = ?
       ORDER BY sfr.id DESC`,
      [s.id]
    );

    // Fetch active bus pass
    const [passes] = await db.query(
      `SELECT * FROM bus_passes WHERE student_id = ? AND status = 'ACTIVE' LIMIT 1`,
      [s.id]
    );

    // Fetch payment history
    const [payments] = await db.query(
      `SELECT p.*, r.receipt_number
       FROM payments p
       LEFT JOIN receipts r ON p.payment_id = r.payment_id
       WHERE p.student_id = ?
       ORDER BY p.payment_date DESC`,
      [s.id]
    );

    res.json({
      success: true,
      data: {
        id: s.id,
        userId: s.user_id,
        rollNo: s.roll_number,
        rollNumber: s.roll_number,
        name: s.name,
        course: s.course,
        admissionNumber: s.admission_number || '',
        parentName: s.parent_name || '',
        year: s.year_of_study,
        phone: s.phone,
        email: s.email,
        address: s.address,
        pickupId: s.pickup_location_id,
        routeId: s.assigned_route_id,
        busId: s.assigned_bus_id,
        status: s.transportation_status,
        location: s.location_name ? {
          id: s.pickup_location_id,
          name: s.location_name,
          zone: s.location_zone,
          distance: s.location_distance
        } : null,
        route: s.route_number ? {
          id: s.assigned_route_id,
          routeNumber: s.route_number,
          title: s.route_name,
          distance: s.route_distance
        } : null,
        bus: s.bus_number ? {
          id: s.assigned_bus_id,
          busNumber: s.bus_number,
          regNumber: s.registration_number
        } : null,
        driver: s.driver_name ? {
          driverId: s.driver_id_code || s.license_number || `DRV-${s.driver_db_id}`,
          driverName: s.driver_name,
          name: s.driver_name,
          phone: s.driver_phone,
          driverPhone: s.driver_phone,
          assignedBusNumber: s.bus_number,
          assignedRoute: s.route_number ? `${s.route_number} - ${s.route_name}` : 'Unassigned'
        } : null,
        feeRecord: feeRecords.length > 0 ? feeRecords[0] : null,
        feeRecords,
        pass: passes.length > 0 ? passes[0] : null,
        payments
      }
    });
  } catch (err) {
    console.error('getStudentById error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving student details.', error: err.message });
  }
};

exports.createStudent = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      name,
      rollNo,
      roll_number,
      email,
      phone,
      course,
      branch,
      admissionNumber,
      admission_number,
      parentName,
      parent_name,
      year,
      address,
      pickupId,
      pickup_location_id,
      routeId,
      assigned_route_id,
      busId,
      assigned_bus_id,
      transportationStatus
    } = req.body;

    const rawRoll = (rollNo || roll_number || '').trim().toUpperCase();
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCourse = (course || branch || 'Engineering').trim();
    const cleanAdmission = (admissionNumber || admission_number || '').trim();
    const cleanParent = (parentName || parent_name || '').trim();

    if (!cleanName || !rawRoll || !cleanEmail) {
      return res.status(400).json({ success: false, message: 'Name, Roll Number, and Email are required.' });
    }

    // 1. Strict Roll Number Format Validation
    if (!isValidRollNumber(rawRoll)) {
      return res.status(400).json({
        success: false,
        message: 'Roll Number must contain exactly 10 letters and numbers with no spaces or special characters.'
      });
    }

    // 2. Strict Roll Number Unique Constraint Check
    const [chkRoll] = await connection.query('SELECT id FROM students WHERE roll_number = ?', [rawRoll]);
    if (chkRoll.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Roll Number already exists. Please enter a different Roll Number.'
      });
    }

    // 3. Email uniqueness check
    const [chkEmail] = await connection.query('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (chkEmail.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A user account with this email address already exists.'
      });
    }

    await connection.beginTransaction();

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);
    const username = rawRoll.toLowerCase().replace(/[^a-z0-9]/g, '');

    const [userRes] = await connection.query(
      `INSERT INTO users (username, email, password_hash, role, full_name, phone, avatar, status)
       VALUES (?, ?, ?, 'student', ?, ?, '👨‍🎓', 'active')`,
      [username, cleanEmail, passwordHash, cleanName, phone || '']
    );

    const userId = userRes.insertId;
    const finalPickup = pickupId || pickup_location_id || null;
    let finalRoute = routeId || assigned_route_id || null;
    let finalBus = busId || assigned_bus_id || null;

    if (finalPickup && !finalRoute) {
      const [l] = await connection.query('SELECT route_id FROM locations WHERE id = ?', [finalPickup]);
      if (l.length > 0 && l[0].route_id) {
        finalRoute = l[0].route_id;
      }
    }

    if (finalRoute && !finalBus) {
      const [r] = await connection.query('SELECT bus_id FROM routes WHERE id = ?', [finalRoute]);
      if (r.length > 0 && r[0].bus_id) {
        finalBus = r[0].bus_id;
      }
    }

    const [stuRes] = await connection.query(
      `INSERT INTO students (
        user_id, roll_number, name, course, admission_number, parent_name,
        year_of_study, phone, email, address, pickup_location_id, assigned_route_id,
        assigned_bus_id, transportation_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, rawRoll, cleanName, cleanCourse, cleanAdmission, cleanParent,
        year || '1st Year', phone || '', cleanEmail, address || '',
        finalPickup, finalRoute, finalBus, transportationStatus || 'approved'
      ]
    );

    const studentId = stuRes.insertId;

    // Automatic Fee calculation if route is assigned
    if (finalRoute) {
      const [feeRows] = await connection.query(
        `SELECT * FROM fee_structures WHERE route_id = ? AND status = 'active' LIMIT 1`,
        [finalRoute]
      );

      let totalFee = 15000.00;
      let feeStructureId = null;
      let ay = '2026-27';
      let sem = '1';

      if (feeRows.length > 0) {
        const fs = feeRows[0];
        feeStructureId = fs.id;
        ay = fs.academic_year;
        sem = fs.semester;
        totalFee = fs.final_fee;
      }

      await connection.query(
        `INSERT INTO student_fee_records (
          student_id, fee_structure_id, route_id, academic_year, semester,
          total_fee, paid_amount, pending_amount, late_fee, total_payable, payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, 0.00, ?, 'UNPAID')`,
        [studentId, feeStructureId, finalRoute, ay, sem, totalFee, totalFee, totalFee]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Student registered successfully!',
      studentId
    });
  } catch (err) {
    await connection.rollback();
    console.error('createStudent error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Roll Number already exists. Please enter a different Roll Number.' });
    }
    res.status(500).json({ success: false, message: 'Server error adding student.', error: err.message });
  } finally {
    connection.release();
  }
};

exports.updateStudent = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const {
      name,
      course,
      admissionNumber,
      admission_number,
      parentName,
      parent_name,
      phone,
      email,
      address,
      year,
      pickupId,
      pickup_location_id,
      routeId,
      assigned_route_id,
      busId,
      assigned_bus_id,
      transportationStatus,
      status
    } = req.body;

    const [current] = await connection.query('SELECT * FROM students WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }
    const stu = current[0];

    await connection.beginTransaction();

    const finalName = name !== undefined ? name.trim() : stu.name;
    const finalCourse = course !== undefined ? course.trim() : stu.course;
    const finalAdmission = admissionNumber !== undefined ? admissionNumber.trim() : (admission_number !== undefined ? admission_number.trim() : stu.admission_number);
    const finalParent = parentName !== undefined ? parentName.trim() : (parent_name !== undefined ? parent_name.trim() : stu.parent_name);
    const finalPhone = phone !== undefined ? phone.trim() : stu.phone;
    const finalEmail = email !== undefined ? email.trim().toLowerCase() : stu.email;
    const finalAddress = address !== undefined ? address.trim() : stu.address;
    const finalYear = year !== undefined ? year.trim() : stu.year_of_study;
    const finalPickup = pickupId !== undefined ? pickupId : (req.body.pickupLocationId !== undefined ? req.body.pickupLocationId : (pickup_location_id !== undefined ? pickup_location_id : stu.pickup_location_id));
    let finalRoute = routeId !== undefined ? routeId : (req.body.assignedRouteId !== undefined ? req.body.assignedRouteId : (assigned_route_id !== undefined ? assigned_route_id : stu.assigned_route_id));
    let finalBus = busId !== undefined ? busId : (req.body.assignedBusId !== undefined ? req.body.assignedBusId : (assigned_bus_id !== undefined ? assigned_bus_id : stu.assigned_bus_id));
    const finalTransStatus = transportationStatus || status || stu.transportation_status;

    // Update students table
    await connection.query(
      `UPDATE students SET
        name = ?, course = ?, admission_number = ?, parent_name = ?,
        phone = ?, email = ?, address = ?, year_of_study = ?,
        pickup_location_id = ?, assigned_route_id = ?, assigned_bus_id = ?,
        transportation_status = ?
       WHERE id = ?`,
      [
        finalName, finalCourse, finalAdmission, finalParent,
        finalPhone, finalEmail, finalAddress, finalYear,
        finalPickup, finalRoute, finalBus, finalTransStatus,
        id
      ]
    );

    // Update corresponding user record
    if (stu.user_id) {
      await connection.query(
        `UPDATE users SET full_name = ?, phone = ?, email = ? WHERE id = ?`,
        [finalName, finalPhone, finalEmail, stu.user_id]
      );
    }

    // If route is assigned, synchronize student fee record!
    if (finalRoute) {
      const [feeRows] = await connection.query(
        `SELECT * FROM fee_structures WHERE route_id = ? AND status = 'active' LIMIT 1`,
        [finalRoute]
      );

      if (feeRows.length > 0) {
        const fs = feeRows[0];
        const newFee = parseFloat(fs.final_fee || 0);

        // Check if fee record exists
        const [feeRecs] = await connection.query(
          `SELECT * FROM student_fee_records WHERE student_id = ? AND academic_year = ? AND semester = ?`,
          [id, fs.academic_year, fs.semester]
        );

        if (feeRecs.length > 0) {
          const paid = parseFloat(feeRecs[0].paid_amount || 0);
          const late = parseFloat(feeRecs[0].late_fee || 0);
          const totalPayable = newFee + late;
          const pending = Math.max(0, totalPayable - paid);
          const pStatus = pending <= 0 ? 'PAID' : (paid > 0 ? 'PARTIALLY PAID' : 'UNPAID');

          await connection.query(
            `UPDATE student_fee_records SET
              fee_structure_id = ?, route_id = ?, total_fee = ?,
              pending_amount = ?, total_payable = ?, payment_status = ?
             WHERE id = ?`,
            [fs.id, finalRoute, newFee, pending, totalPayable, pStatus, feeRecs[0].id]
          );
        } else {
          await connection.query(
            `INSERT INTO student_fee_records (
              student_id, fee_structure_id, route_id, academic_year, semester,
              total_fee, paid_amount, pending_amount, late_fee, total_payable, payment_status
            ) VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, 0.00, ?, 'UNPAID')`,
            [id, fs.id, finalRoute, fs.academic_year, fs.semester, newFee, newFee, newFee]
          );
        }
      }
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Student profile updated successfully in MySQL!'
    });
  } catch (err) {
    await connection.rollback();
    console.error('updateStudent error:', err);
    res.status(500).json({ success: false, message: 'Server error updating student.', error: err.message });
  } finally {
    connection.release();
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const [stu] = await db.query('SELECT user_id FROM students WHERE id = ?', [id]);
    if (stu.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    // Deleting student or associated user triggers ON DELETE CASCADE in MySQL
    if (stu[0].user_id) {
      await db.query('DELETE FROM users WHERE id = ?', [stu[0].user_id]);
    } else {
      await db.query('DELETE FROM students WHERE id = ?', [id]);
    }

    res.json({ success: true, message: 'Student and linked user deleted successfully from database.' });
  } catch (err) {
    console.error('deleteStudent error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete student.', error: err.message });
  }
};

/**
 * Helper to resolve authenticated or requested student ID safely
 */
async function getEffectiveStudent(req) {
  let studentId = null;

  // Check Bearer Token if provided in Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.studentId) {
        studentId = decoded.studentId;
      } else if (decoded.id && decoded.role === 'student') {
        const [st] = await db.query('SELECT id FROM students WHERE user_id = ? OR id = ?', [decoded.id, decoded.id]);
        if (st.length > 0) studentId = st[0].id;
      }
    } catch (e) {
      // Ignored token error; fallback to other identification methods
    }
  }

  if (!studentId && req.user && req.user.studentId) {
    studentId = req.user.studentId;
  } else if (!studentId && req.user && req.user.id && req.user.role === 'student') {
    const [st] = await db.query('SELECT id FROM students WHERE user_id = ?', [req.user.id]);
    if (st.length > 0) studentId = st[0].id;
  } else if (!studentId && req.headers['x-student-id']) {
    studentId = req.headers['x-student-id'];
  } else if (!studentId && req.headers['x-user-id']) {
    const [st] = await db.query('SELECT id FROM students WHERE user_id = ? OR id = ?', [req.headers['x-user-id'], req.headers['x-user-id']]);
    if (st.length > 0) studentId = st[0].id;
  } else if (!studentId && req.query.studentId) {
    studentId = req.query.studentId;
  } else if (!studentId && (req.query.rollNumber || req.query.rollNo)) {
    const roll = req.query.rollNumber || req.query.rollNo;
    const [st] = await db.query('SELECT id FROM students WHERE UPPER(roll_number) = UPPER(?)', [roll]);
    if (st.length > 0) studentId = st[0].id;
  }

  // If user is logged in as a student, ensure they can only access their own record
  if (req.user && req.user.role === 'student' && req.user.studentId && req.user.studentId != studentId) {
    return null;
  }

  return studentId;
}

/**
 * POST /api/students/register
 */
exports.studentRegister = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      studentId,
      student_id,
      rollNumber,
      roll_number,
      rollNo,
      name,
      studentName,
      password,
      department,
      course,
      branch,
      year,
      year_of_study,
      semester,
      email,
      phone,
      address,
      pickupId,
      pickup_location_id
    } = req.body;

    const rawRoll = (studentId || student_id || rollNumber || roll_number || rollNo || '').trim().toUpperCase();
    const cleanName = (name || studentName || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (phone || '').trim();
    const cleanDept = (department || course || branch || 'Engineering').trim();
    const cleanYear = (year || year_of_study || '1st Year').trim();
    const cleanSemester = (semester || '1').toString().trim();
    const cleanPassword = password || '';

    if (!rawRoll || !cleanName || !cleanPassword || !cleanEmail || !cleanPhone) {
      return res.status(400).json({
        success: false,
        message: 'Student ID / Roll Number, Name, Password, Email, and Phone Number are required.'
      });
    }

    // Strict Unique Roll Number Validation
    const [existingStudent] = await connection.query(
      'SELECT id FROM students WHERE roll_number = ?',
      [rawRoll]
    );

    if (existingStudent.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Student ID / Roll Number already exists. Please enter a different Student ID / Roll Number.'
      });
    }

    // Unique Email check
    const [existingEmail] = await connection.query(
      'SELECT id FROM users WHERE LOWER(email) = ?',
      [cleanEmail]
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please log in or use a different email.'
      });
    }

    await connection.beginTransaction();

    // Securely hash password using bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(cleanPassword, salt);
    const username = rawRoll.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Insert user record
    const [userRes] = await connection.query(
      `INSERT INTO users (username, email, password_hash, role, full_name, phone, avatar, status)
       VALUES (?, ?, ?, 'student', ?, ?, '👨‍🎓', 'active')`,
      [username, cleanEmail, passwordHash, cleanName, cleanPhone]
    );

    const userId = userRes.insertId;

    // Resolve pickup location and route
    let finalPickup = pickupId || pickup_location_id || null;
    let assignedRouteId = null;
    let assignedBusId = null;

    if (finalPickup) {
      const [locs] = await connection.query('SELECT route_id FROM locations WHERE id = ?', [finalPickup]);
      if (locs.length > 0 && locs[0].route_id) {
        assignedRouteId = locs[0].route_id;
        const [routes] = await connection.query('SELECT bus_id FROM routes WHERE id = ?', [assignedRouteId]);
        if (routes.length > 0) assignedBusId = routes[0].bus_id;
      }
    }

    if (!assignedRouteId) {
      const [availRoutes] = await connection.query('SELECT id, bus_id FROM routes ORDER BY id ASC LIMIT 1');
      if (availRoutes.length > 0) {
        assignedRouteId = availRoutes[0].id;
        assignedBusId = availRoutes[0].bus_id;
      }
    }

    if (!assignedBusId && assignedRouteId) {
      const [routes] = await connection.query('SELECT bus_id FROM routes WHERE id = ?', [assignedRouteId]);
      if (routes.length > 0 && routes[0].bus_id) assignedBusId = routes[0].bus_id;
    }

    if (!assignedBusId) {
      const [availBuses] = await connection.query('SELECT id FROM buses ORDER BY id ASC LIMIT 1');
      if (availBuses.length > 0) assignedBusId = availBuses[0].id;
    }

    if (!finalPickup) {
      const [availLocs] = await connection.query('SELECT id FROM locations ORDER BY id ASC LIMIT 1');
      if (availLocs.length > 0) finalPickup = availLocs[0].id;
    }

    // Insert into students table
    const [studentRes] = await connection.query(
      `INSERT INTO students (
        user_id, roll_number, name, course, year_of_study, semester,
        phone, email, address, pickup_location_id, assigned_route_id, assigned_bus_id,
        transportation_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        userId, rawRoll, cleanName, cleanDept, cleanYear, cleanSemester,
        cleanPhone, cleanEmail, address || '', finalPickup, assignedRouteId, assignedBusId
      ]
    );

    const newStudentId = studentRes.insertId;

    // Auto-create fee record if route assigned
    if (assignedRouteId) {
      const [feeRows] = await connection.query(
        `SELECT * FROM fee_structures WHERE route_id = ? AND status = 'active' LIMIT 1`,
        [assignedRouteId]
      );
      let feeAmount = 15000.00;
      let fsId = null;
      let ay = '2026-27';
      if (feeRows.length > 0) {
        feeAmount = parseFloat(feeRows[0].final_fee);
        fsId = feeRows[0].id;
        ay = feeRows[0].academic_year;
      }
      await connection.query(
        `INSERT INTO student_fee_records (
          student_id, fee_structure_id, route_id, academic_year, semester,
          total_fee, paid_amount, pending_amount, late_fee, total_payable, payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, 0.00, ?, 'PENDING')`,
        [newStudentId, fsId, assignedRouteId, ay, cleanSemester, feeAmount, feeAmount, feeAmount]
      );
    }

    // Welcome Notification
    await connection.query(
      `INSERT INTO notifications (user_id, target_role, title, message, category)
       VALUES (?, 'student', 'Welcome to College Transit', 'Your account has been registered. You can now access your dashboard and bus details.', 'success')`,
      [userId]
    );

    await connection.commit();

    const token = jwt.sign(
      { id: userId, username, role: 'student', studentId: newStudentId, rollNumber: rawRoll },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const safeUser = {
      id: newStudentId,
      studentId: rawRoll,
      rollNumber: rawRoll,
      name: cleanName,
      department: cleanDept,
      course: cleanDept,
      year: cleanYear,
      semester: cleanSemester,
      email: cleanEmail,
      phone: cleanPhone,
      role: 'student'
    };

    return res.status(201).json({
      success: true,
      message: 'Student registered successfully!',
      user: safeUser,
      student: safeUser,
      token
    });
  } catch (err) {
    await connection.rollback();
    console.error('studentRegister error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Student ID / Roll Number or Email already exists. Please choose a different Student ID / Roll Number.'
      });
    }
    res.status(500).json({ success: false, message: 'Server error registering student.', error: err.message });
  } finally {
    connection.release();
  }
};

/**
 * POST /api/students/login
 */
exports.studentLogin = async (req, res) => {
  try {
    const { studentId, student_id, rollNumber, roll_number, rollNo, identifier, email, username, password } = req.body;
    const lookup = (studentId || student_id || rollNumber || roll_number || rollNo || identifier || email || username || '').trim();

    if (!lookup || !password) {
      return res.status(400).json({ success: false, message: 'Please enter Student ID / Roll Number and password.' });
    }

    const [students] = await db.query(
      `SELECT s.*, u.id AS auth_user_id, u.username, u.email AS user_email, u.password_hash, u.status AS user_status,
              r.route_number, r.route_name,
              b.bus_number
       FROM students s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN routes r ON s.assigned_route_id = r.id
       LEFT JOIN buses b ON s.assigned_bus_id = b.id
       WHERE (UPPER(s.roll_number) = UPPER(?) OR LOWER(u.email) = LOWER(?) OR LOWER(u.username) = LOWER(?))
       LIMIT 1`,
      [lookup, lookup, lookup]
    );

    if (students.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid Student ID or password.' });
    }

    const s = students[0];

    const isMatch = await bcrypt.compare(password, s.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid Student ID or password.' });
    }

    if (s.user_status === 'inactive') {
      return res.status(403).json({ success: false, message: 'Student account is inactive. Please contact administration.' });
    }

    const token = jwt.sign(
      { id: s.auth_user_id, username: s.username, role: 'student', studentId: s.id, rollNumber: s.roll_number },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const safeStudent = {
      id: s.id,
      userId: s.auth_user_id,
      studentId: s.roll_number,
      rollNumber: s.roll_number,
      name: s.name,
      department: s.course,
      course: s.course,
      year: s.year_of_study,
      semester: s.semester || '1',
      email: s.email,
      phone: s.phone,
      assignedRoute: s.route_number ? `${s.route_number} - ${s.route_name}` : null,
      assignedBus: s.bus_number || null,
      transportationStatus: s.transportation_status,
      role: 'student'
    };

    return res.json({
      success: true,
      message: `Welcome back, ${s.name}!`,
      user: safeStudent,
      student: safeStudent,
      token
    });
  } catch (err) {
    console.error('studentLogin error:', err);
    res.status(500).json({ success: false, message: 'Server error during student login.', error: err.message });
  }
};

/**
 * GET /api/students/profile
 */
exports.getStudentProfile = async (req, res) => {
  try {
    const studentId = await getEffectiveStudent(req);
    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Authentication required. Please sign in as a student.' });
    }

    const [rows] = await db.query(
      `SELECT s.id, s.roll_number, s.name, s.course AS department, s.year_of_study AS year,
              s.semester, s.email, s.phone, s.address, s.transportation_status,
              r.route_number, r.route_name,
              b.bus_number,
              l.name AS pickup_location_name
       FROM students s
       LEFT JOIN routes r ON s.assigned_route_id = r.id
       LEFT JOIN buses b ON s.assigned_bus_id = b.id
       LEFT JOIN locations l ON s.pickup_location_id = l.id
       WHERE s.id = ? LIMIT 1`,
      [studentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const s = rows[0];
    res.json({
      success: true,
      data: {
        studentId: s.roll_number,
        studentName: s.name,
        department: s.department,
        year: s.year,
        semester: s.semester || '1',
        email: s.email,
        phone: s.phone,
        address: s.address,
        assignedRoute: s.route_number ? `${s.route_number} - ${s.route_name}` : 'Unassigned',
        assignedBus: s.bus_number || 'Unassigned',
        pickupPoint: s.pickup_location_name || 'Unassigned',
        transportationStatus: s.transportation_status
      }
    });
  } catch (err) {
    console.error('getStudentProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving profile.', error: err.message });
  }
};

/**
 * GET /api/students/bus
 */
exports.getStudentBus = async (req, res) => {
  try {
    const studentId = await getEffectiveStudent(req);
    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const [rows] = await db.query(
      `SELECT s.id, s.assigned_bus_id, s.assigned_route_id,
              b.bus_number, b.registration_number, b.capacity, b.status AS bus_status,
              r.route_number, r.route_name,
              sfr.total_fee AS bus_fee,
              d.id AS driver_id, d.driver_id_code, d.name AS driver_name, d.phone AS driver_phone,
              d.license_number,
              ll.trip_status, ll.latitude, ll.longitude, ll.speed_kmh
       FROM students s
       LEFT JOIN buses b ON s.assigned_bus_id = b.id
       LEFT JOIN routes r ON s.assigned_route_id = r.id
       LEFT JOIN student_fee_records sfr ON s.id = sfr.student_id
       LEFT JOIN drivers d ON (d.assigned_bus_id = b.id OR r.driver_id = d.id)
       LEFT JOIN live_locations ll ON b.id = ll.bus_id
       WHERE s.id = ? LIMIT 1`,
      [studentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const row = rows[0];
    res.json({
      success: true,
      data: {
        busNumber: row.bus_number || 'Unassigned',
        assignedBus: row.bus_number ? {
          busNumber: row.bus_number,
          registrationNumber: row.registration_number,
          capacity: row.capacity,
          status: row.bus_status
        } : null,
        route: row.route_number ? `${row.route_number} - ${row.route_name}` : 'Unassigned',
        busFee: parseFloat(row.bus_fee || 0),
        driver: row.driver_name ? {
          driverId: row.driver_id_code || row.license_number,
          driverName: row.driver_name,
          assignedBusNumber: row.bus_number,
          assignedRoute: row.route_number ? `${row.route_number} - ${row.route_name}` : 'Unassigned',
          driverPhone: row.driver_phone,
          tripStatus: row.trip_status || 'Standby',
          currentLocation: row.latitude ? { lat: parseFloat(row.latitude), lng: parseFloat(row.longitude), speed: row.speed_kmh } : null
        } : null
      }
    });
  } catch (err) {
    console.error('getStudentBus error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving bus details.', error: err.message });
  }
};

/**
 * GET /api/students/route
 */
exports.getStudentRoute = async (req, res) => {
  try {
    const studentId = await getEffectiveStudent(req);
    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const [rows] = await db.query(
      `SELECT s.id, s.assigned_route_id, s.pickup_location_id,
              r.route_number, r.route_name, r.start_point, r.end_point, r.distance_km, r.timing,
              l.name AS pickup_name, l.morning_pickup_time, l.evening_drop_time
       FROM students s
       LEFT JOIN routes r ON s.assigned_route_id = r.id
       LEFT JOIN locations l ON s.pickup_location_id = l.id
       WHERE s.id = ? LIMIT 1`,
      [studentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const row = rows[0];
    let stops = [];
    if (row.assigned_route_id) {
      const [stopRows] = await db.query(
        'SELECT stop_name, stop_order, pickup_time, drop_time, distance_from_start_km FROM route_stops WHERE route_id = ? ORDER BY stop_order ASC',
        [row.assigned_route_id]
      );
      stops = stopRows;
    }

    res.json({
      success: true,
      data: {
        routeName: row.route_name ? `${row.route_number} - ${row.route_name}` : 'Unassigned',
        startingPoint: row.start_point || 'Not specified',
        destination: row.end_point || 'Main College Campus',
        routeDetails: {
          routeNumber: row.route_number,
          routeName: row.route_name,
          distanceKm: parseFloat(row.distance_km || 0),
          timing: row.timing,
          stops
        },
        pickupPoint: row.pickup_name || 'Not assigned',
        pickupTime: row.morning_pickup_time || '07:45 AM',
        dropPoint: row.pickup_name || 'Not assigned',
        dropTime: row.evening_drop_time || '05:30 PM'
      }
    });
  } catch (err) {
    console.error('getStudentRoute error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving route details.', error: err.message });
  }
};

/**
 * GET /api/students/fees
 */
exports.getStudentFees = async (req, res) => {
  try {
    const studentId = await getEffectiveStudent(req);
    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const [rows] = await db.query(
      `SELECT sfr.*, s.roll_number, s.name AS student_name
       FROM student_fee_records sfr
       JOIN students s ON sfr.student_id = s.id
       WHERE sfr.student_id = ?
       ORDER BY sfr.id DESC LIMIT 1`,
      [studentId]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: {
          totalFee: 0,
          paidAmount: 0,
          pendingAmount: 0,
          lateFee: 0,
          totalPayable: 0,
          paymentStatus: 'PENDING'
        }
      });
    }

    const r = rows[0];
    const totalFee = parseFloat(r.total_fee);
    const paidAmount = parseFloat(r.paid_amount);
    const lateFee = parseFloat(r.late_fee || 0);
    const totalPayable = totalFee + lateFee;
    const pendingAmount = Math.max(0, totalPayable - paidAmount);
    const paymentStatus = pendingAmount <= 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIALLY PAID' : 'PENDING');

    res.json({
      success: true,
      data: {
        id: r.id,
        studentId: r.roll_number,
        studentName: r.student_name,
        semester: r.semester,
        academicYear: r.academic_year,
        totalFee,
        paidAmount,
        pendingAmount,
        lateFee,
        totalPayable,
        paymentStatus
      }
    });
  } catch (err) {
    console.error('getStudentFees error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving fees.', error: err.message });
  }
};

/**
 * POST /api/students/payments
 */
exports.processStudentPayment = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const studentId = await getEffectiveStudent(req);
    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { amount, paymentMethod, payment_method, academicYear } = req.body;
    const [students] = await connection.query('SELECT * FROM students WHERE id = ?', [studentId]);
    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }
    const student = students[0];

    const [feeRecords] = await connection.query(
      'SELECT * FROM student_fee_records WHERE student_id = ? ORDER BY id DESC LIMIT 1',
      [student.id]
    );

    if (feeRecords.length === 0) {
      return res.status(400).json({ success: false, message: 'No fee record found for student. Please contact administration.' });
    }
    const feeRecord = feeRecords[0];

    const payAmount = parseFloat(amount || feeRecord.pending_amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    }

    const currentPending = parseFloat(feeRecord.pending_amount);
    if (currentPending > 0 && payAmount > currentPending) {
      return res.status(400).json({
        success: false,
        message: `Payment amount of ₹${payAmount} cannot exceed pending fee balance of ₹${currentPending}.`
      });
    }

    const finalMethod = (paymentMethod || payment_method || 'Online').trim();
    const ay = academicYear || feeRecord.academic_year || '2026-27';

    await connection.beginTransaction();

    const txnId = await generateTransactionId();

    const [payResult] = await connection.query(
      `INSERT INTO payments (
        student_id, fee_record_id, amount, payment_method, transaction_id, payment_status, payment_date
      ) VALUES (?, ?, ?, ?, ?, 'SUCCESSFUL', NOW())`,
      [student.id, feeRecord.id, payAmount, finalMethod, txnId]
    );
    const paymentId = payResult.insertId;

    const receiptNo = await generateReceiptNumber(ay);
    const amountInWords = numberToWords(payAmount);

    await connection.query(
      `INSERT INTO receipts (
        payment_id, student_id, receipt_number, fee_particulars, amount, amount_in_words, payment_mode, receipt_date
      ) VALUES (?, ?, ?, 'Annual Transportation Fee', ?, ?, ?, NOW())`,
      [paymentId, student.id, receiptNo, payAmount, amountInWords, finalMethod]
    );

    const newPaid = parseFloat(feeRecord.paid_amount) + payAmount;
    const totalDue = parseFloat(feeRecord.total_payable);
    const newPending = Math.max(0, totalDue - newPaid);
    const newStatus = newPending <= 0 ? 'PAID' : (newPaid > 0 ? 'PARTIALLY PAID' : 'PENDING');

    await connection.query(
      `UPDATE student_fee_records SET
        paid_amount = ?, pending_amount = ?, payment_status = ?
       WHERE id = ?`,
      [newPaid, newPending, newStatus, feeRecord.id]
    );

    if (student.transportation_status === 'pending') {
      await connection.query("UPDATE students SET transportation_status = 'approved' WHERE id = ?", [student.id]);
    }

    if (student.user_id) {
      await connection.query(
        `INSERT INTO notifications (user_id, target_role, title, message, category)
         VALUES (?, 'student', 'Payment Successful', ?, 'success')`,
        [student.user_id, `Payment of ₹${payAmount.toLocaleString('en-IN')} received. Receipt No: ${receiptNo}.`]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Payment processed successfully! Simulated transaction recorded in database.',
      transactionId: txnId,
      paidAmount: newPaid,
      pendingAmount: newPending,
      paymentStatus: newStatus,
      receipt: {
        receiptNumber: receiptNo,
        transactionId: txnId,
        studentId: student.roll_number,
        amount: payAmount,
        receiptDate: new Date().toISOString(),
        paymentStatus: newStatus
      }
    });
  } catch (err) {
    await connection.rollback();
    console.error('processStudentPayment error:', err);
    res.status(500).json({ success: false, message: 'Server error processing payment.', error: err.message });
  } finally {
    connection.release();
  }
};

/**
 * GET /api/students/payments
 */
exports.getStudentPaymentHistory = async (req, res) => {
  try {
    const studentId = await getEffectiveStudent(req);
    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const [rows] = await db.query(
      `SELECT p.payment_id, p.transaction_id, p.amount, p.payment_method, p.payment_date, p.payment_status,
              r.receipt_number
       FROM payments p
       LEFT JOIN receipts r ON p.payment_id = r.payment_id
       WHERE p.student_id = ?
       ORDER BY p.payment_date DESC`,
      [studentId]
    );

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('getStudentPaymentHistory error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving payments.', error: err.message });
  }
};

/**
 * GET /api/students/receipts
 */
exports.getStudentReceiptsList = async (req, res) => {
  try {
    const studentId = await getEffectiveStudent(req);
    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const [rows] = await db.query(
      `SELECT r.id, r.receipt_number, r.amount, r.payment_mode, r.receipt_date, r.fee_particulars,
              p.transaction_id, p.payment_status,
              s.roll_number AS student_id, s.name AS student_name
       FROM receipts r
       JOIN payments p ON r.payment_id = p.payment_id
       JOIN students s ON r.student_id = s.id
       WHERE r.student_id = ?
       ORDER BY r.id DESC`,
      [studentId]
    );

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('getStudentReceiptsList error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving receipts.', error: err.message });
  }
};

/**
 * POST /api/students/bus-pass
 */
exports.applyBusPassRequest = async (req, res) => {
  try {
    const studentId = await getEffectiveStudent(req);
    if (!studentId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { passRequest, reason, remarks } = req.body;
    const passReason = (reason || remarks || passRequest || 'Regular daily campus commute').trim();

    const [students] = await db.query('SELECT * FROM students WHERE id = ?', [studentId]);
    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }
    const student = students[0];

    let routeId = student.assigned_route_id;
    let busId = student.assigned_bus_id;
    let pickupId = student.pickup_location_id;

    if (!routeId) {
      const [r] = await db.query('SELECT id, bus_id FROM routes ORDER BY id ASC LIMIT 1');
      if (r.length > 0) {
        routeId = r[0].id;
        if (!busId) busId = r[0].bus_id;
      }
    }
    if (!busId) {
      const [b] = await db.query('SELECT id FROM buses ORDER BY id ASC LIMIT 1');
      if (b.length > 0) busId = b[0].id;
    }
    if (!pickupId) {
      const [l] = await db.query('SELECT id FROM locations ORDER BY id ASC LIMIT 1');
      if (l.length > 0) pickupId = l[0].id;
    }

    // Insert pass request
    const [result] = await db.query(
      `INSERT INTO bus_pass_applications (
        student_id, roll_number, route_id, bus_id, pickup_location_id, status, reason, applied_date
      ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, NOW())`,
      [student.id, student.roll_number, routeId, busId, pickupId, passReason]
    );

    // Notify admin
    await db.query(
      `INSERT INTO notifications (user_id, target_role, title, message, category)
       VALUES (NULL, 'admin', 'Bus Pass Application Submitted', ?, 'info')`,
      [`Student ${student.name} (${student.roll_number}) submitted bus pass request. Reason: ${passReason}`]
    );

    res.status(201).json({
      success: true,
      message: 'Bus pass request submitted successfully! Status: PENDING',
      applicationId: result.insertId,
      status: 'PENDING',
      reason: passReason
    });
  } catch (err) {
    console.error('applyBusPassRequest error:', err);
    res.status(500).json({ success: false, message: 'Server error submitting bus pass request.', error: err.message });
  }
};

/**
 * GET /api/students/notifications
 */
exports.getStudentNotificationsList = async (req, res) => {
  try {
    const studentId = await getEffectiveStudent(req);
    let userId = null;
    if (studentId) {
      const [st] = await db.query('SELECT user_id FROM students WHERE id = ?', [studentId]);
      if (st.length > 0) userId = st[0].user_id;
    }

    let query = `
      SELECT * FROM notifications
      WHERE target_role = 'student' OR target_role = 'all'
    `;
    const params = [];

    if (userId) {
      query = `
        SELECT * FROM notifications
        WHERE user_id = ? OR target_role = 'student' OR target_role = 'all'
      `;
      params.push(userId);
    }

    query += ` ORDER BY id DESC LIMIT 50`;

    const [rows] = await db.query(query, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('getStudentNotificationsList error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving notifications.', error: err.message });
  }
};

