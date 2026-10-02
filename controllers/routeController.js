const db = require('../config/db');

exports.getAllRoutes = async (req, res) => {
  try {
    const [routes] = await db.query(`
      SELECT r.*,
             b.bus_number, b.registration_number,
             d.name AS driver_name, d.phone AS driver_phone,
             fs.final_fee, fs.fee_calculation_type,
             (SELECT COUNT(*) FROM students s WHERE s.assigned_route_id = r.id) AS student_count
      FROM routes r
      LEFT JOIN buses b ON r.bus_id = b.id
      LEFT JOIN drivers d ON (r.driver_id = d.id OR d.assigned_bus_id = b.id)
      LEFT JOIN fee_structures fs ON r.id = fs.route_id AND fs.status = 'active'
      ORDER BY r.id ASC
    `);

    // Fetch stops for each route
    for (const route of routes) {
      const [stops] = await db.query(
        'SELECT * FROM route_stops WHERE route_id = ? ORDER BY stop_order ASC',
        [route.id]
      );
      route.stops = stops;
      route.totalStops = stops.length;
      route.busNumber = route.bus_number || 'Unassigned';
      route.driverName = route.driver_name || 'Unassigned';
      route.driverPhone = route.driver_phone || '-';
      route.studentCount = route.student_count;
      route.fee = route.final_fee || 0;
    }

    res.json({ success: true, count: routes.length, data: routes });
  } catch (err) {
    console.error('getAllRoutes error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving routes.', error: err.message });
  }
};

exports.getRouteById = async (req, res) => {
  try {
    const { id } = req.params;
    const [routes] = await db.query(`
      SELECT r.*,
             b.bus_number, b.registration_number,
             d.name AS driver_name, d.phone AS driver_phone,
             fs.final_fee, fs.fee_calculation_type
      FROM routes r
      LEFT JOIN buses b ON r.bus_id = b.id
      LEFT JOIN drivers d ON (r.driver_id = d.id OR d.assigned_bus_id = b.id)
      LEFT JOIN fee_structures fs ON r.id = fs.route_id AND fs.status = 'active'
      WHERE r.id = ? OR r.route_number = ?
    `, [id, id]);

    if (routes.length === 0) {
      return res.status(404).json({ success: false, message: 'Route not found.' });
    }

    const route = routes[0];
    const [stops] = await db.query('SELECT * FROM route_stops WHERE route_id = ? ORDER BY stop_order ASC', [route.id]);
    const [students] = await db.query('SELECT id, roll_number, name, course, phone FROM students WHERE assigned_route_id = ?', [route.id]);

    route.stops = stops;
    route.students = students;

    res.json({ success: true, data: route });
  } catch (err) {
    console.error('getRouteById error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving route.', error: err.message });
  }
};

exports.createRoute = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      routeNumber,
      route_number,
      title,
      route_name,
      startPoint,
      start_point,
      endPoint,
      end_point,
      distance,
      distance_km,
      timing,
      academicYear,
      academic_year,
      semester,
      busId,
      bus_id,
      driverId,
      driver_id,
      stops
    } = req.body;

    const rNumber = (routeNumber || route_number || '').trim();
    const rName = (req.body.routeName || title || route_name || '').trim();
    const rStart = (startPoint || start_point || '').trim();
    const rEnd = (endPoint || end_point || 'Main College Campus').trim();
    const rDist = parseFloat(req.body.distanceKm || distance_km || distance || 0);
    const rTiming = (timing || '07:30 AM - 08:35 AM').trim();
    const rAy = (academicYear || academic_year || '2026-27').trim();
    const rSem = (semester || '1').trim();
    const rBus = busId || bus_id || null;
    const rDriver = driverId || driver_id || null;

    if (!rNumber || !rName || !rStart) {
      return res.status(400).json({ success: false, message: 'Route number, name, and start point are required.' });
    }

    // Check duplicate route number
    const [chk] = await connection.query('SELECT id FROM routes WHERE route_number = ?', [rNumber]);
    if (chk.length > 0) {
      return res.status(409).json({ success: false, message: 'Route with this route number already exists.' });
    }

    await connection.beginTransaction();

    const [routeRes] = await connection.query(
      `INSERT INTO routes (
        route_number, route_name, start_point, end_point, distance_km,
        bus_id, driver_id, timing, academic_year, semester, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [rNumber, rName, rStart, rEnd, rDist, rBus, rDriver, rTiming, rAy, rSem]
    );

    const routeId = routeRes.insertId;

    // Insert stops
    const stopsList = Array.isArray(stops) && stops.length > 0 ? stops : [
      { order: 1, name: rStart, time: '07:30 AM', dropTime: '05:30 PM', lat: 13.5510, lng: 78.5020, dist: 0.00 },
      { order: 2, name: rEnd, time: '08:35 AM', dropTime: '04:30 PM', lat: 13.6200, lng: 78.5800, dist: rDist }
    ];

    for (let i = 0; i < stopsList.length; i++) {
      const s = stopsList[i];
      await connection.query(
        `INSERT INTO route_stops (
          route_id, stop_order, stop_name, pickup_time, drop_time, latitude, longitude, distance_from_start_km
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          routeId,
          s.order || (i + 1),
          s.name || s.stop_name,
          s.time || s.pickup_time || '07:45 AM',
          s.dropTime || s.drop_time || '05:30 PM',
          s.lat || s.latitude || null,
          s.lng || s.longitude || null,
          s.dist || s.distance_from_start_km || 0.00
        ]
      );
    }

    // Auto-create default fee structure for this route
    await connection.query(
      `INSERT INTO fee_structures (
        route_id, bus_id, academic_year, semester, fee_calculation_type,
        fee_per_km, fixed_route_fee, calculated_distance_km, final_fee, status
      ) VALUES (?, ?, ?, ?, 'FIXED_ROUTE', 0.00, 15000.00, ?, 15000.00, 'active')`,
      [routeId, rBus, rAy, rSem, rDist]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'New route created successfully in database!',
      routeId
    });
  } catch (err) {
    await connection.rollback();
    console.error('createRoute error:', err);
    res.status(500).json({ success: false, message: 'Server error creating route.', error: err.message });
  } finally {
    connection.release();
  }
};

exports.updateRoute = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const {
      routeNumber,
      title,
      startPoint,
      endPoint,
      distance,
      timing,
      busId,
      driverId,
      status,
      stops
    } = req.body;

    const [current] = await connection.query('SELECT * FROM routes WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Route not found.' });
    }
    const r = current[0];

    const rNum = routeNumber !== undefined ? routeNumber.trim() : r.route_number;
    const rTitle = title !== undefined ? title.trim() : r.route_name;
    const rStart = startPoint !== undefined ? startPoint.trim() : r.start_point;
    const rEnd = endPoint !== undefined ? endPoint.trim() : r.end_point;
    const rDist = distance !== undefined ? parseFloat(distance) : r.distance_km;
    const rTiming = timing !== undefined ? timing.trim() : r.timing;
    const rBus = busId !== undefined ? busId : r.bus_id;
    const rDriver = driverId !== undefined ? driverId : r.driver_id;
    const rStatus = status || r.status;

    await connection.beginTransaction();

    await connection.query(
      `UPDATE routes SET
        route_number = ?, route_name = ?, start_point = ?, end_point = ?,
        distance_km = ?, bus_id = ?, driver_id = ?, timing = ?, status = ?
       WHERE id = ?`,
      [rNum, rTitle, rStart, rEnd, rDist, rBus, rDriver, rTiming, rStatus, id]
    );

    // If new stops array provided, update route_stops
    if (stops && Array.isArray(stops)) {
      await connection.query('DELETE FROM route_stops WHERE route_id = ?', [id]);
      for (let i = 0; i < stops.length; i++) {
        const s = stops[i];
        await connection.query(
          `INSERT INTO route_stops (
            route_id, stop_order, stop_name, pickup_time, drop_time, latitude, longitude, distance_from_start_km
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            s.order || (i + 1),
            s.name || s.stop_name,
            s.time || s.pickup_time || '07:45 AM',
            s.dropTime || s.drop_time || '05:30 PM',
            s.lat || s.latitude || null,
            s.lng || s.longitude || null,
            s.dist || s.distance_from_start_km || 0.00
          ]
        );
      }
    }

    // If distance changed and fee structure is PER_KM, recalculate fee structure
    if (distance !== undefined) {
      const [feeRows] = await connection.query(
        'SELECT * FROM fee_structures WHERE route_id = ? AND fee_calculation_type = "PER_KM"',
        [id]
      );
      if (feeRows.length > 0) {
        const fs = feeRows[0];
        const newFinal = Math.round(rDist * parseFloat(fs.fee_per_km));
        await connection.query(
          'UPDATE fee_structures SET calculated_distance_km = ?, final_fee = ? WHERE id = ?',
          [rDist, newFinal, fs.id]
        );
      }
    }

    await connection.commit();

    res.json({ success: true, message: 'Route updated successfully in database!' });
  } catch (err) {
    await connection.rollback();
    console.error('updateRoute error:', err);
    res.status(500).json({ success: false, message: 'Server error updating route.', error: err.message });
  } finally {
    connection.release();
  }
};

exports.deleteRoute = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM routes WHERE id = ?', [id]);
    res.json({ success: true, message: 'Route deleted successfully.' });
  } catch (err) {
    console.error('deleteRoute error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete route.', error: err.message });
  }
};
