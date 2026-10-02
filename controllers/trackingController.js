const db = require('../config/db');

/**
 * 1. Update Driver Live GPS Location from navigator.geolocation.watchPosition()
 * Stores in MySQL live_locations table
 */
exports.updateLocation = async (req, res) => {
  try {
    const {
      busId,
      bus_id,
      tripId,
      trip_id,
      latitude,
      longitude,
      speed,
      heading,
      currentStop,
      nextStop,
      etaNextStop,
      tripStatus
    } = req.body;

    const bId = busId || bus_id || (req.user && req.user.assignedBusId);
    if (!bId) {
      return res.status(400).json({ success: false, message: 'Bus ID is required to update location telemetry.' });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required.' });
    }

    const spd = parseFloat(speed || 0);
    const hdg = parseFloat(heading || 0);
    const cStop = currentStop || null;
    const nStop = nextStop || null;
    const eta = etaNextStop || null;
    const tStat = tripStatus || 'In Transit';

    await db.query(
      `INSERT INTO live_locations (
        bus_id, trip_id, latitude, longitude, speed_kmh, heading_degrees,
        current_stop_name, next_stop_name, eta_next_stop, trip_status, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        trip_id = VALUES(trip_id),
        latitude = VALUES(latitude),
        longitude = VALUES(longitude),
        speed_kmh = VALUES(speed_kmh),
        heading_degrees = VALUES(heading_degrees),
        current_stop_name = VALUES(current_stop_name),
        next_stop_name = VALUES(next_stop_name),
        eta_next_stop = VALUES(eta_next_stop),
        trip_status = VALUES(trip_status),
        last_updated = NOW()`,
      [bId, tripId || trip_id || null, lat, lng, spd, hdg, cStop, nStop, eta, tStat]
    );

    // Update bus speed
    await db.query('UPDATE buses SET speed = ? WHERE id = ?', [`${Math.round(spd)} km/h`, bId]);

    res.json({
      success: true,
      message: 'Telemetry updated in MySQL.',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('updateLocation error:', err);
    res.status(500).json({ success: false, message: 'Server error updating location telemetry.', error: err.message });
  }
};

/**
 * 2. Student Dashboard: Student views ONLY their assigned bus! (Requirement 34)
 */
exports.getStudentAssignedBusLocation = async (req, res) => {
  try {
    const { studentId } = req.params;

    let [students] = await db.query(
      `SELECT s.id, s.name, s.roll_number, s.assigned_bus_id, s.assigned_route_id,
              b.bus_number, b.registration_number,
              r.route_number, r.route_name,
              d.name AS driver_name, d.phone AS driver_phone
       FROM students s
       LEFT JOIN buses b ON s.assigned_bus_id = b.id
       LEFT JOIN routes r ON s.assigned_route_id = r.id
       LEFT JOIN drivers d ON (b.id = d.assigned_bus_id OR r.driver_id = d.id)
       WHERE s.id = ?
       LIMIT 1`,
      [studentId]
    );

    if (students.length === 0) {
      [students] = await db.query(
        `SELECT s.id, s.name, s.roll_number, s.assigned_bus_id, s.assigned_route_id,
                b.bus_number, b.registration_number,
                r.route_number, r.route_name,
                d.name AS driver_name, d.phone AS driver_phone
         FROM students s
         LEFT JOIN buses b ON s.assigned_bus_id = b.id
         LEFT JOIN routes r ON s.assigned_route_id = r.id
         LEFT JOIN drivers d ON (b.id = d.assigned_bus_id OR r.driver_id = d.id)
         WHERE s.user_id = ? OR UPPER(s.roll_number) = UPPER(?)
         LIMIT 1`,
        [studentId, studentId]
      );
    }

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }
    const student = students[0];

    if (!student.assigned_bus_id) {
      return res.json({
        success: true,
        hasBus: false,
        message: 'No bus assigned yet to your transportation profile.'
      });
    }

    // Fetch live location for this student's assigned bus ONLY
    const [locs] = await db.query(
      'SELECT * FROM live_locations WHERE bus_id = ?',
      [student.assigned_bus_id]
    );

    // Fetch route stops
    const [stops] = await db.query(
      'SELECT * FROM route_stops WHERE route_id = ? ORDER BY stop_order ASC',
      [student.assigned_route_id]
    );

    const telemetry = locs.length > 0 ? locs[0] : null;

    res.json({
      success: true,
      hasBus: true,
      data: {
        busId: student.assigned_bus_id,
        busNumber: student.bus_number,
        regNumber: student.registration_number,
        routeId: student.assigned_route_id,
        routeNumber: student.route_number,
        routeName: student.route_name,
        driverName: student.driver_name || 'Assigned Fleet Driver',
        driverPhone: student.driver_phone || '-',
        tripStatus: telemetry ? telemetry.trip_status : 'Standby / Scheduled',
        speed: telemetry ? `${Math.round(telemetry.speed_kmh)} km/h` : '0 km/h',
        currentStop: telemetry ? telemetry.current_stop_name : (stops.length > 0 ? stops[0].stop_name : 'Depot'),
        nextStop: telemetry ? telemetry.next_stop_name : (stops.length > 1 ? stops[1].stop_name : 'Campus'),
        etaNextStop: telemetry && telemetry.eta_next_stop ? telemetry.eta_next_stop : '10 mins',
        lastUpdated: telemetry ? telemetry.last_updated : 'Awaiting driver GPS broadcast',
        latitude: telemetry ? parseFloat(telemetry.latitude) : (stops.length > 0 ? parseFloat(stops[0].latitude) : 13.5510),
        longitude: telemetry ? parseFloat(telemetry.longitude) : (stops.length > 0 ? parseFloat(stops[0].longitude) : 78.5020),
        stops
      }
    });
  } catch (err) {
    console.error('getStudentAssignedBusLocation error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving assigned bus tracking.', error: err.message });
  }
};

/**
 * 3. Driver: Start Trip
 */
exports.startTrip = async (req, res) => {
  try {
    const { busId, routeId, driverId, tripType } = req.body;
    const finalBusId = busId || (req.user && req.user.assignedBusId);
    const finalDriverId = driverId || (req.user && req.user.driverId);

    if (!finalBusId) {
      return res.status(400).json({ success: false, message: 'Bus ID is required to start a trip.' });
    }

    const [routes] = await db.query('SELECT * FROM routes WHERE bus_id = ? OR id = ?', [finalBusId, routeId || 0]);
    const finalRouteId = routeId || (routes.length > 0 ? routes[0].id : null);

    const [tripRes] = await db.query(
      `INSERT INTO trips (bus_id, route_id, driver_id, trip_type, status, start_time)
       VALUES (?, ?, ?, ?, 'in_progress', NOW())`,
      [finalBusId, finalRouteId, finalDriverId, tripType || 'morning_pickup']
    );

    const tripId = tripRes.insertId;

    // Update or insert live location status
    await db.query(
      `INSERT INTO live_locations (bus_id, trip_id, latitude, longitude, speed_kmh, trip_status, last_updated)
       VALUES (?, ?, 13.5510, 78.5020, 0, 'In Transit', NOW())
       ON DUPLICATE KEY UPDATE trip_id = ?, trip_status = 'In Transit', last_updated = NOW()`,
      [finalBusId, tripId, tripId]
    );

    res.json({
      success: true,
      message: 'Trip started successfully. GPS telemetry active.',
      tripId
    });
  } catch (err) {
    console.error('startTrip error:', err);
    res.status(500).json({ success: false, message: 'Server error starting trip.', error: err.message });
  }
};

/**
 * 4. Driver: End Trip
 */
exports.endTrip = async (req, res) => {
  try {
    const { tripId, busId } = req.body;
    const finalBusId = busId || (req.user && req.user.assignedBusId);

    if (tripId) {
      await db.query('UPDATE trips SET status = "completed", end_time = NOW() WHERE id = ?', [tripId]);
    } else if (finalBusId) {
      await db.query('UPDATE trips SET status = "completed", end_time = NOW() WHERE bus_id = ? AND status = "in_progress"', [finalBusId]);
    }

    if (finalBusId) {
      await db.query(
        `UPDATE live_locations SET trip_status = 'Standby', speed_kmh = 0, last_updated = NOW() WHERE bus_id = ?`,
        [finalBusId]
      );
    }

    res.json({
      success: true,
      message: 'Trip completed successfully. Standby mode enabled.'
    });
  } catch (err) {
    console.error('endTrip error:', err);
    res.status(500).json({ success: false, message: 'Server error ending trip.', error: err.message });
  }
};

/**
 * 5. Admin: Fleet Live Radar (all active telemetry)
 */
exports.getAllLiveBuses = async (req, res) => {
  try {
    const [buses] = await db.query(`
      SELECT b.id AS bus_id, b.bus_number, b.registration_number, b.status AS bus_status,
             r.id AS route_id, r.route_number, r.route_name,
             d.name AS driver_name, d.phone AS driver_phone,
             ll.latitude, ll.longitude, ll.speed_kmh, ll.current_stop_name, ll.next_stop_name,
             ll.eta_next_stop, ll.trip_status, ll.last_updated
      FROM buses b
      LEFT JOIN routes r ON b.id = r.bus_id
      LEFT JOIN drivers d ON b.id = d.assigned_bus_id
      LEFT JOIN live_locations ll ON b.id = ll.bus_id
      ORDER BY b.id ASC
    `);

    res.json({ success: true, count: buses.length, data: buses });
  } catch (err) {
    console.error('getAllLiveBuses error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving fleet radar.', error: err.message });
  }
};

/**
 * 6. Get Telemetry for a specific Bus by busId
 */
exports.getBusTelemetryById = async (req, res) => {
  try {
    const { busId } = req.params;
    const [buses] = await db.query(`
      SELECT b.id AS bus_id, b.bus_number, b.registration_number,
             r.id AS route_id, r.route_number, r.route_name,
             d.name AS driver_name, d.phone AS driver_phone,
             ll.latitude, ll.longitude, ll.speed_kmh, ll.current_stop_name, ll.next_stop_name,
             ll.eta_next_stop, ll.trip_status, ll.last_updated
      FROM buses b
      LEFT JOIN routes r ON b.id = r.bus_id
      LEFT JOIN drivers d ON b.id = d.assigned_bus_id
      LEFT JOIN live_locations ll ON b.id = ll.bus_id
      WHERE b.id = ? OR b.bus_number = ?
    `, [busId, busId]);

    if (buses.length === 0) {
      return res.status(404).json({ success: false, message: 'Bus not found.' });
    }

    const b = buses[0];
    let stops = [];
    if (b.route_id) {
      const [stRows] = await db.query('SELECT * FROM route_stops WHERE route_id = ? ORDER BY stop_order ASC', [b.route_id]);
      stops = stRows.map(s => ({
        id: s.id,
        name: s.stop_name,
        time: s.pickup_time || '07:30 AM',
        lat: parseFloat(s.latitude),
        lng: parseFloat(s.longitude)
      }));
    }

    res.json({
      success: true,
      data: {
        busId: b.bus_id,
        busNumber: b.bus_number,
        regNumber: b.registration_number,
        routeId: b.route_id,
        routeName: b.route_number ? `${b.route_number} - ${b.route_name}` : 'Campus Route',
        driverName: b.driver_name || 'Fleet Driver',
        driverPhone: b.driver_phone || '-',
        tripStatus: b.trip_status || 'Scheduled',
        speed: b.speed_kmh ? Math.round(b.speed_kmh) : 0,
        currentStop: b.current_stop_name || (stops[0] ? stops[0].name : 'Terminal'),
        nextStop: b.next_stop_name || (stops[1] ? stops[1].name : 'Main Campus'),
        etaNextStop: b.eta_next_stop || '10 mins',
        etaCampus: '25 mins',
        lastUpdated: b.last_updated ? new Date(b.last_updated).toLocaleTimeString() : 'Now',
        progressPercent: b.trip_status === 'In Transit' ? 55 : (b.trip_status === 'Standby' ? 100 : 15),
        routeDetails: { stops }
      }
    });
  } catch (err) {
    console.error('getBusTelemetryById error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving telemetry.', error: err.message });
  }
};

/**
 * 7. Driver: Update Trip Status (Start, End, Advance Stop, Traffic Delay)
 */
exports.updateDriverTripStatus = async (req, res) => {
  try {
    const busId = req.params.busId || req.body.busId || (req.user && req.user.assignedBusId);
    const { action, delayMinutes, currentStop, nextStop } = req.body;

    if (!busId) {
      return res.status(400).json({ success: false, message: 'Bus ID is required.' });
    }

    if (action === 'START_TRIP') {
      await db.query(
        `INSERT INTO live_locations (bus_id, trip_status, speed_kmh, last_updated)
         VALUES (?, 'In Transit', 42, NOW())
         ON DUPLICATE KEY UPDATE trip_status = 'In Transit', speed_kmh = 42, last_updated = NOW()`,
        [busId]
      );
      return res.json({ success: true, message: 'Trip successfully started! GPS telemetry streaming live.' });
    }

    if (action === 'END_TRIP') {
      await db.query(
        `UPDATE live_locations SET trip_status = 'Standby', speed_kmh = 0, last_updated = NOW() WHERE bus_id = ?`,
        [busId]
      );
      return res.json({ success: true, message: 'Trip completed! Bus is safely parked at campus depot.' });
    }

    if (action === 'ADVANCE_STOP') {
      const [locs] = await db.query('SELECT current_stop_name, next_stop_name FROM live_locations WHERE bus_id = ?', [busId]);
      const [routes] = await db.query('SELECT r.id FROM routes r JOIN buses b ON r.bus_id = b.id WHERE b.id = ?', [busId]);
      if (routes.length > 0) {
        const [stops] = await db.query('SELECT stop_name FROM route_stops WHERE route_id = ? ORDER BY stop_order ASC', [routes[0].id]);
        if (stops.length > 0) {
          const curIdx = stops.findIndex(s => s.stop_name === (locs[0] ? locs[0].next_stop_name : ''));
          const nextIdx = curIdx >= 0 && curIdx + 1 < stops.length ? curIdx + 1 : 0;
          const newCur = stops[curIdx >= 0 ? curIdx : 0].stop_name;
          const newNext = stops[nextIdx].stop_name;

          await db.query(
            `UPDATE live_locations SET current_stop_name = ?, next_stop_name = ?, last_updated = NOW() WHERE bus_id = ?`,
            [newCur, newNext, busId]
          );
          return res.json({ success: true, message: `Advanced to: ${newCur} (Next: ${newNext})` });
        }
      }
      return res.json({ success: true, message: 'Advanced to next stop.' });
    }

    if (delayMinutes) {
      const [students] = await db.query('SELECT user_id FROM students WHERE assigned_bus_id = ?', [busId]);
      for (const s of students) {
        if (s.user_id) {
          await db.query(
            `INSERT INTO notifications (user_id, target_role, title, message, category)
             VALUES (?, 'student', 'Traffic Delay Alert ⚠️', ?, 'warning')`,
            [s.user_id, `Your bus is delayed by approximately ${delayMinutes} minutes due to route traffic conditions.`]
          );
        }
      }
      return res.json({ success: true, message: `Delay alert of ${delayMinutes} mins broadcast to all assigned students.` });
    }

    res.json({ success: true, message: 'Status updated.' });
  } catch (err) {
    console.error('updateDriverTripStatus error:', err);
    res.status(500).json({ success: false, message: 'Server error updating trip status.', error: err.message });
  }
};

