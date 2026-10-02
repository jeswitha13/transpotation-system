const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET } = require('../middleware/auth');
const { isValidRollNumber } = require('../utils/codeGenerators');

exports.login = async (req, res) => {
  try {
    const idField = req.body.identifier || req.body.emailOrRoll || req.body.email || req.body.username || req.body.rollNo;
    const { password, role } = req.body;
    if (!idField || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email/username/roll number and password.' });
    }

    const cleanIdentifier = String(idField).trim();

    // Look up user by email, username, student roll number, or driver ID/name
    const [users] = await db.query(
      `SELECT u.*, s.id AS student_id, s.roll_number, s.course, s.year_of_study, s.transportation_status,
              s.pickup_location_id, s.assigned_route_id, s.assigned_bus_id,
              d.id AS driver_id, d.driver_id_code, d.license_number, d.assigned_bus_id AS driver_bus_id
       FROM users u
       LEFT JOIN students s ON u.id = s.user_id
       LEFT JOIN drivers d ON u.id = d.user_id
       WHERE (LOWER(u.email) = LOWER(?) OR LOWER(u.username) = LOWER(?)
              OR (s.roll_number IS NOT NULL AND UPPER(s.roll_number) = UPPER(?))
              OR (d.driver_id_code IS NOT NULL AND UPPER(d.driver_id_code) = UPPER(?))
              OR (d.license_number IS NOT NULL AND UPPER(d.license_number) = UPPER(?))
              OR (d.name IS NOT NULL AND LOWER(d.name) = LOWER(?)))
       ${role ? 'AND u.role = ?' : ''}
       LIMIT 1`,
      role ? [cleanIdentifier, cleanIdentifier, cleanIdentifier, cleanIdentifier, cleanIdentifier, cleanIdentifier, role]
           : [cleanIdentifier, cleanIdentifier, cleanIdentifier, cleanIdentifier, cleanIdentifier, cleanIdentifier]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or account does not exist.' });
    }

    const user = users[0];

    // Verify password with bcrypt
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password entered.' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ success: false, message: 'Your account is deactivated. Contact administration.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      name: user.full_name,
      phone: user.phone,
      avatar: user.avatar,
      studentId: user.student_id || null,
      rollNo: user.roll_number || null,
      rollNumber: user.roll_number || null,
      course: user.course || null,
      transportationStatus: user.transportation_status || null,
      pickupId: user.pickup_location_id || null,
      routeId: user.assigned_route_id || null,
      busId: user.assigned_bus_id || null,
      driverId: user.driver_id || null,
      licenseNumber: user.license_number || null
    };

    return res.json({
      success: true,
      message: `Welcome back, ${user.full_name}!`,
      user: safeUser,
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.', error: err.message });
  }
};

exports.register = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      name,
      rollNo,
      roll_number,
      email,
      phone,
      username,
      password,
      address,
      pickupId,
      branch,
      course,
      year,
      semester
    } = req.body;

    const rawRoll = (rollNo || roll_number || '').trim().toUpperCase();
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCourse = (course || branch || 'Engineering').trim();
    const cleanYear = (year || '1st Year').trim();
    const cleanSemester = (semester || '1').trim();

    if (!cleanName || !rawRoll || !cleanEmail || !password) {
      return res.status(400).json({ success: false, message: 'Name, roll number, email, and password are required.' });
    }

    // 1. Roll Number Format Validation
    if (!isValidRollNumber(rawRoll)) {
      return res.status(400).json({
        success: false,
        message: 'Roll Number / Student ID must contain 3-20 letters and numbers with no spaces or special characters.'
      });
    }

    // 2. Strict Unique Roll Number Validation: Check if student with this roll number already exists
    const [existingStudent] = await connection.query(
      'SELECT id, roll_number FROM students WHERE roll_number = ?',
      [rawRoll]
    );

    if (existingStudent.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Roll Number already exists. Please enter a different Roll Number.'
      });
    }

    // 3. Unique Email Check in users
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

    // Hash password using bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const preferredUsername = (username || rawRoll).toLowerCase().replace(/[^a-z0-9]/g, '');

    await connection.beginTransaction();

    // Insert user record
    const [userResult] = await connection.query(
      `INSERT INTO users (username, email, password_hash, role, full_name, phone, avatar, status)
       VALUES (?, ?, ?, 'student', ?, ?, '👨‍🎓', 'active')`,
      [preferredUsername, cleanEmail, passwordHash, cleanName, phone || '']
    );

    const userId = userResult.insertId;

    // Check location & assigned route if pickup provided
    let pickupLocationId = null;
    let assignedRouteId = null;
    let assignedBusId = null;

    if (pickupId) {
      const [locs] = await connection.query('SELECT * FROM locations WHERE id = ?', [pickupId]);
      if (locs.length > 0) {
        pickupLocationId = locs[0].id;
        assignedRouteId = locs[0].route_id;
        if (assignedRouteId) {
          const [routes] = await connection.query('SELECT bus_id FROM routes WHERE id = ?', [assignedRouteId]);
          if (routes.length > 0) {
            assignedBusId = routes[0].bus_id;
          }
        }
      }
    }

    // Insert student record
    const [studentResult] = await connection.query(
      `INSERT INTO students (
        user_id, roll_number, name, course, year_of_study, semester, phone, email, address,
        pickup_location_id, assigned_route_id, assigned_bus_id, transportation_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        userId, rawRoll, cleanName, cleanCourse, cleanYear, cleanSemester, phone || '', cleanEmail, address || '',
        pickupLocationId, assignedRouteId, assignedBusId
      ]
    );

    const studentId = studentResult.insertId;

    // Create transportation application
    if (pickupLocationId) {
      await connection.query(
        `INSERT INTO transportation_applications (student_id, pickup_location_id, preferred_route_id, status)
         VALUES (?, ?, ?, 'pending')`,
        [studentId, pickupLocationId, assignedRouteId]
      );
    }

    // If route is known, auto-calculate and create Student Fee Record
    if (assignedRouteId) {
      const [feeRows] = await connection.query(
        `SELECT * FROM fee_structures WHERE route_id = ? AND status = 'active' LIMIT 1`,
        [assignedRouteId]
      );

      let totalFee = 0;
      let feeStructureId = null;
      let ay = '2026-27';
      let sem = '1';

      if (feeRows.length > 0) {
        const fs = feeRows[0];
        feeStructureId = fs.id;
        ay = fs.academic_year;
        sem = fs.semester;
        totalFee = fs.final_fee;
      } else {
        // Fallback default base fee if fee structure is yet to be created
        totalFee = 15000.00;
      }

      await connection.query(
        `INSERT INTO student_fee_records (
          student_id, fee_structure_id, route_id, academic_year, semester,
          total_fee, paid_amount, pending_amount, late_fee, total_payable, payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, 0.00, ?, 'UNPAID')`,
        [studentId, feeStructureId, assignedRouteId, ay, sem, totalFee, totalFee, totalFee]
      );
    }

    // Create notification for admin
    await connection.query(
      `INSERT INTO notifications (user_id, target_role, title, message, category)
       VALUES (NULL, 'admin', 'New Student Registered', ?, 'info')`,
      [`Student ${cleanName} (Roll No: ${rawRoll}) registered for transportation.`]
    );

    // Create welcoming notification for student
    await connection.query(
      `INSERT INTO notifications (user_id, target_role, title, message, category)
       VALUES (?, 'student', 'Welcome to College Transit', 'Your account has been registered. Proceed to pay your transportation fee to unlock your digital bus pass.', 'success')`,
      [userId]
    );

    await connection.commit();

    const token = jwt.sign(
      { id: userId, username: preferredUsername, role: 'student', email: cleanEmail },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const safeUser = {
      id: userId,
      username: preferredUsername,
      email: cleanEmail,
      role: 'student',
      name: cleanName,
      phone: phone || '',
      studentId: studentId,
      rollNo: rawRoll,
      rollNumber: rawRoll,
      course: cleanCourse,
      pickupId: pickupLocationId,
      routeId: assignedRouteId,
      busId: assignedBusId,
      transportationStatus: 'pending'
    };

    return res.status(201).json({
      success: true,
      message: 'Registration successful! You may now sign in or pay your transit fee.',
      user: safeUser,
      studentId: studentId,
      token
    });
  } catch (err) {
    await connection.rollback();
    console.error('Registration error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('roll_number')) {
        return res.status(409).json({ success: false, message: 'Roll Number already exists. Please enter a different Roll Number.' });
      }
      return res.status(409).json({ success: false, message: 'A student with this roll number or email already exists.' });
    }
    res.status(500).json({ success: false, message: 'Registration failed due to a server error.', error: err.message });
  } finally {
    connection.release();
  }
};

exports.getMe = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : (req.headers['x-user-id'] || req.query.userId);
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required.' });
    }

    const [users] = await db.query(
      `SELECT u.id, u.username, u.email, u.role, u.full_name, u.phone, u.avatar, u.status,
              s.id AS student_id, s.roll_number, s.course, s.admission_number, s.parent_name,
              s.year_of_study, s.address, s.pickup_location_id, s.assigned_route_id, s.assigned_bus_id,
              s.transportation_status,
              d.id AS driver_id, d.license_number, d.assigned_bus_id AS driver_bus_id
       FROM users u
       LEFT JOIN students s ON u.id = s.user_id
       LEFT JOIN drivers d ON u.id = d.user_id
       WHERE u.id = ? LIMIT 1`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User record not found.' });
    }

    const u = users[0];
    const safeUser = {
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      name: u.full_name,
      phone: u.phone,
      avatar: u.avatar,
      status: u.status,
      studentId: u.student_id || null,
      rollNo: u.roll_number || null,
      rollNumber: u.roll_number || null,
      course: u.course || null,
      admissionNumber: u.admission_number || null,
      parentName: u.parent_name || null,
      yearOfStudy: u.year_of_study || null,
      address: u.address || null,
      pickupId: u.pickup_location_id || null,
      routeId: u.assigned_route_id || null,
      busId: u.assigned_bus_id || null,
      transportationStatus: u.transportation_status || null,
      driverId: u.driver_id || null,
      licenseNumber: u.license_number || null
    };

    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error('getMe error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving user.', error: err.message });
  }
};
