const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

exports.driverRegister = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { name, driverName, driverId, driver_id, password, phone, experience } = req.body;
    const finalName = (name || driverName || '').trim();
    const finalId = (driverId || driver_id || '').trim();
    const finalPassword = password || '';
    const finalPhone = (phone || '').trim();
    const finalExp = (experience || '5 Years').trim();

    if (!finalName || !finalId || !finalPassword) {
      return res.status(400).json({
        success: false,
        message: 'Driver Name, Driver ID, and Password are required.'
      });
    }

    // Check duplicate Driver ID in drivers table
    const [existing] = await connection.query(
      'SELECT id FROM drivers WHERE driver_id_code = ? OR license_number = ?',
      [finalId, finalId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Driver ID already exists. Please choose a different Driver ID.'
      });
    }

    const cleanUsername = finalId.toLowerCase().replace(/[^a-z0-9]/g, '');
    const [existingUser] = await connection.query(
      'SELECT id FROM users WHERE LOWER(username) = ?',
      [cleanUsername]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Driver ID already exists. Please choose a different Driver ID.'
      });
    }

    await connection.beginTransaction();

    // Securely hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(finalPassword, salt);
    const driverEmail = `driver_${Date.now()}_${cleanUsername}@college.edu`;

    // Insert user record
    const [userResult] = await connection.query(
      `INSERT INTO users (username, email, password_hash, role, full_name, phone, avatar, status)
       VALUES (?, ?, ?, 'driver', ?, ?, '👮‍♂️', 'active')`,
      [cleanUsername, driverEmail, passwordHash, finalName, finalPhone]
    );

    const userId = userResult.insertId;

    // Insert driver record
    const [driverResult] = await connection.query(
      `INSERT INTO drivers (user_id, name, driver_id_code, license_number, phone, experience, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [userId, finalName, finalId, finalId, finalPhone, finalExp]
    );

    const driverDbId = driverResult.insertId;

    await connection.commit();

    const token = jwt.sign(
      { id: userId, username: cleanUsername, role: 'driver', driverId: driverDbId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const safeDriver = {
      id: driverDbId,
      userId,
      driverId: finalId,
      name: finalName,
      phone: finalPhone,
      role: 'driver'
    };

    return res.status(201).json({
      success: true,
      message: 'Driver registered successfully!',
      driver: safeDriver,
      token
    });
  } catch (err) {
    await connection.rollback();
    console.error('driverRegister error:', err);
    res.status(500).json({ success: false, message: 'Server error registering driver.', error: err.message });
  } finally {
    connection.release();
  }
};

exports.driverLogin = async (req, res) => {
  try {
    const { driverId, driver_id, name, identifier, password } = req.body;
    const lookup = (driverId || driver_id || name || identifier || '').trim();
    if (!lookup || !password) {
      return res.status(400).json({ success: false, message: 'Please enter your Driver ID / registered name and password.' });
    }

    const [drivers] = await db.query(
      `SELECT d.*, u.id AS auth_user_id, u.username, u.email, u.password_hash, u.status AS user_status,
              b.bus_number, b.registration_number,
              r.id AS route_id, r.route_number, r.route_name
       FROM drivers d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN buses b ON d.assigned_bus_id = b.id
       LEFT JOIN routes r ON (b.id = r.bus_id OR d.id = r.driver_id)
       WHERE (UPPER(d.driver_id_code) = UPPER(?) OR UPPER(d.license_number) = UPPER(?)
              OR LOWER(d.name) = LOWER(?) OR LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?))
       LIMIT 1`,
      [lookup, lookup, lookup, lookup, lookup]
    );

    if (drivers.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid Driver ID or account does not exist.' });
    }

    const d = drivers[0];

    const isMatch = await bcrypt.compare(password, d.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password entered.' });
    }

    if (d.user_status === 'inactive' || d.status === 'inactive') {
      return res.status(403).json({ success: false, message: 'Your driver account is inactive. Please contact administration.' });
    }

    const token = jwt.sign(
      { id: d.auth_user_id, username: d.username, role: 'driver', driverId: d.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const safeDriver = {
      id: d.id,
      userId: d.auth_user_id,
      driverId: d.driver_id_code || d.license_number,
      name: d.name,
      phone: d.phone,
      licenseNumber: d.license_number,
      assignedBusId: d.assigned_bus_id,
      busNumber: d.bus_number || 'Unassigned',
      routeId: d.route_id || null,
      routeName: d.route_number ? `${d.route_number} - ${d.route_name}` : 'Unassigned Route',
      role: 'driver'
    };

    return res.json({
      success: true,
      message: `Welcome back, ${d.name}!`,
      driver: safeDriver,
      user: safeDriver,
      token
    });
  } catch (err) {
    console.error('driverLogin error:', err);
    res.status(500).json({ success: false, message: 'Server error during driver login.', error: err.message });
  }
};

exports.getDriverProfile = async (req, res) => {
  try {
    let driverId = null;

    // Check Bearer Token if provided in Authorization header
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.driverId) {
          driverId = decoded.driverId;
        } else if (decoded.id && decoded.role === 'driver') {
          const [dr] = await db.query('SELECT id FROM drivers WHERE user_id = ? OR id = ?', [decoded.id, decoded.id]);
          if (dr.length > 0) driverId = dr[0].id;
        }
      } catch (e) {
        // Ignored token error; fallback
      }
    }

    if (!driverId && req.user && req.user.driverId) {
      driverId = req.user.driverId;
    } else if (!driverId && req.user && req.user.role === 'driver') {
      driverId = req.user.id;
    } else if (!driverId && req.query.driverId) {
      driverId = req.query.driverId;
    } else if (!driverId && req.headers['x-driver-id']) {
      driverId = req.headers['x-driver-id'];
    }

    if (!driverId) {
      return res.status(400).json({ success: false, message: 'Driver identification required.' });
    }

    const [drivers] = await db.query(
      `SELECT d.*, u.email,
              b.bus_number, b.registration_number,
              r.id AS route_id, r.route_number, r.route_name,
              ll.trip_status
       FROM drivers d
       LEFT JOIN users u ON d.user_id = u.id
       LEFT JOIN buses b ON d.assigned_bus_id = b.id
       LEFT JOIN routes r ON (b.id = r.bus_id OR d.id = r.driver_id)
       LEFT JOIN live_locations ll ON b.id = ll.bus_id
       WHERE d.id = ? OR d.user_id = ? OR UPPER(d.driver_id_code) = UPPER(?) OR UPPER(d.license_number) = UPPER(?)
       LIMIT 1`,
      [driverId, driverId, driverId, driverId]
    );

    if (drivers.length === 0) {
      return res.status(404).json({ success: false, message: 'Driver profile not found.' });
    }

    const d = drivers[0];
    res.json({
      success: true,
      data: {
        id: d.id,
        driverId: d.driver_id_code || d.license_number,
        driverName: d.name,
        name: d.name,
        phone: d.phone,
        email: d.email,
        licenseNumber: d.license_number,
        experience: d.experience,
        status: d.status,
        assignedBusNumber: d.bus_number || 'Unassigned',
        assignedBus: d.bus_number ? { busNumber: d.bus_number, regNumber: d.registration_number } : null,
        assignedRoute: d.route_number ? `${d.route_number} - ${d.route_name}` : 'Unassigned',
        tripStatus: d.trip_status || 'Standby'
      }
    });
  } catch (err) {
    console.error('getDriverProfile error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving driver profile.', error: err.message });
  }
};


exports.getAllDrivers = async (req, res) => {
  try {
    const [drivers] = await db.query(`
      SELECT d.*,
             b.bus_number, b.registration_number,
             r.id AS route_id, r.route_number, r.route_name
      FROM drivers d
      LEFT JOIN buses b ON d.assigned_bus_id = b.id
      LEFT JOIN routes r ON (b.id = r.bus_id OR d.id = r.driver_id)
      ORDER BY d.id ASC
    `);

    const formatted = drivers.map(d => ({
      id: d.id,
      userId: d.user_id,
      name: d.name,
      phone: d.phone,
      license: d.license_number,
      experience: d.experience,
      status: d.status,
      busId: d.assigned_bus_id,
      busNumber: d.bus_number || 'Unassigned',
      busReg: d.registration_number || '',
      routeId: d.route_id || null,
      routeName: d.route_number ? `${d.route_number} - ${d.route_name}` : 'Unassigned Route'
    }));

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    console.error('getAllDrivers error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving drivers.', error: err.message });
  }
};

exports.getDriverById = async (req, res) => {
  try {
    const { id } = req.params;
    const [drivers] = await db.query(`
      SELECT d.*,
             b.bus_number, b.registration_number,
             r.id AS route_id, r.route_number, r.route_name
      FROM drivers d
      LEFT JOIN buses b ON d.assigned_bus_id = b.id
      LEFT JOIN routes r ON (b.id = r.bus_id OR d.id = r.driver_id)
      WHERE d.id = ? OR d.user_id = ?
    `, [id, id]);

    if (drivers.length === 0) {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }

    const d = drivers[0];

    // Fetch Route Stops
    let stops = [];
    if (d.route_id) {
      const [stRows] = await db.query(
        'SELECT * FROM route_stops WHERE route_id = ? ORDER BY stop_order ASC',
        [d.route_id]
      );
      stops = stRows.map(st => ({
        id: st.id,
        name: st.stop_name,
        time: st.pickup_time || '07:30 AM',
        lat: parseFloat(st.latitude),
        lng: parseFloat(st.longitude),
        order: st.stop_order
      }));
    }

    // Fetch Assigned Students for this Bus
    let assignedStudents = [];
    if (d.assigned_bus_id) {
      const [stuRows] = await db.query(`
        SELECT s.id, s.name, s.roll_number AS rollNo, s.course, s.phone,
               s.transportation_status, l.name AS pickupLocation,
               bp.status AS passStatus, bp.pass_number AS passNumber
        FROM students s
        LEFT JOIN locations l ON s.pickup_location_id = l.id
        LEFT JOIN bus_passes bp ON s.id = bp.student_id AND bp.status = 'ACTIVE'
        WHERE s.assigned_bus_id = ? AND s.transportation_status != 'cancelled'
        ORDER BY s.name ASC
      `, [d.assigned_bus_id]);
      assignedStudents = stuRows;
    }

    // Fetch Live Telemetry
    let telemetry = null;
    if (d.assigned_bus_id) {
      const [telRows] = await db.query(
        'SELECT * FROM live_locations WHERE bus_id = ?',
        [d.assigned_bus_id]
      );
      if (telRows.length > 0) {
        telemetry = telRows[0];
      }
    }

    res.json({
      success: true,
      data: {
        id: d.id,
        userId: d.user_id,
        name: d.name,
        phone: d.phone,
        license: d.license_number,
        experience: d.experience,
        status: d.status,
        busId: d.assigned_bus_id,
        busNumber: d.bus_number || 'Unassigned',
        busReg: d.registration_number || '',
        routeId: d.route_id,
        routeName: d.route_number ? `${d.route_number} - ${d.route_name}` : 'Unassigned',
        route: {
          id: d.route_id,
          routeNumber: d.route_number || 'Route',
          title: d.route_name || 'Assigned Route',
          stops
        },
        assignedStudents,
        telemetry
      }
    });
  } catch (err) {
    console.error('getDriverById error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving driver.', error: err.message });
  }
};

exports.createDriver = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { name, phone, license, license_number, experience, busId, assigned_bus_id, email, password } = req.body;
    const dName = (name || '').trim();
    const dPhone = (phone || '').trim();
    const dLic = (license || license_number || '').trim().toUpperCase();
    const dExp = (experience || '5 Years').trim();
    const dBus = busId || assigned_bus_id || null;
    const dEmail = (email || `driver_${Date.now()}@college.edu`).trim().toLowerCase();

    if (!dName || !dPhone || !dLic) {
      return res.status(400).json({ success: false, message: 'Driver name, phone, and license number are required.' });
    }

    // Check duplicate license
    const [chk] = await connection.query('SELECT id FROM drivers WHERE license_number = ?', [dLic]);
    if (chk.length > 0) {
      return res.status(409).json({ success: false, message: 'Driver with this license number already exists.' });
    }

    await connection.beginTransaction();

    // Create user credentials for driver
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password || 'password123', salt);
    const username = dLic.toLowerCase().replace(/[^a-z0-9]/g, '');

    const [uRes] = await connection.query(
      `INSERT INTO users (username, email, password_hash, role, full_name, phone, avatar, status)
       VALUES (?, ?, ?, 'driver', ?, ?, '👮‍♂️', 'active')`,
      [username, dEmail, passwordHash, dName, dPhone]
    );

    const userId = uRes.insertId;

    const [dRes] = await connection.query(
      `INSERT INTO drivers (user_id, name, phone, license_number, experience, assigned_bus_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [userId, dName, dPhone, dLic, dExp, dBus]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Driver profile created successfully in database!',
      driverId: dRes.insertId
    });
  } catch (err) {
    await connection.rollback();
    console.error('createDriver error:', err);
    res.status(500).json({ success: false, message: 'Server error creating driver.', error: err.message });
  } finally {
    connection.release();
  }
};

exports.updateDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, license, experience, busId, status } = req.body;

    const [current] = await db.query('SELECT * FROM drivers WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }
    const d = current[0];

    const finalName = name !== undefined ? name.trim() : d.name;
    const finalPhone = phone !== undefined ? phone.trim() : d.phone;
    const finalLic = license !== undefined ? license.trim().toUpperCase() : d.license_number;
    const finalExp = experience !== undefined ? experience.trim() : d.experience;
    const finalBus = busId !== undefined ? busId : d.assigned_bus_id;
    const finalStatus = status !== undefined ? status : d.status;

    await db.query(
      `UPDATE drivers SET
        name = ?, phone = ?, license_number = ?, experience = ?,
        assigned_bus_id = ?, status = ?
       WHERE id = ?`,
      [finalName, finalPhone, finalLic, finalExp, finalBus, finalStatus, id]
    );

    if (d.user_id) {
      await db.query('UPDATE users SET full_name = ?, phone = ? WHERE id = ?', [finalName, finalPhone, d.user_id]);
    }

    res.json({ success: true, message: 'Driver details updated successfully!' });
  } catch (err) {
    console.error('updateDriver error:', err);
    res.status(500).json({ success: false, message: 'Server error updating driver.', error: err.message });
  }
};

exports.deleteDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const [d] = await db.query('SELECT user_id FROM drivers WHERE id = ?', [id]);
    if (d.length === 0) {
      return res.status(404).json({ success: false, message: 'Driver not found.' });
    }

    if (d[0].user_id) {
      await db.query('DELETE FROM users WHERE id = ?', [d[0].user_id]);
    } else {
      await db.query('DELETE FROM drivers WHERE id = ?', [id]);
    }

    res.json({ success: true, message: 'Driver deleted successfully.' });
  } catch (err) {
    console.error('deleteDriver error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete driver.', error: err.message });
  }
};
