const db = require('../config/db');

exports.getAllLocations = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT l.*, r.route_number, r.route_name
      FROM locations l
      LEFT JOIN routes r ON l.route_id = r.id
      ORDER BY l.id ASC
    `);

    const formatted = rows.map(l => ({
      id: l.id,
      name: l.name,
      zone: l.zone,
      distanceKm: l.distance_km,
      distance: `${l.distance_km} km`,
      fee: 14000,
      routeId: l.route_id,
      routeName: l.route_number ? `${l.route_number} - ${l.route_name}` : 'Unassigned',
      morningPickupTime: l.morning_pickup_time,
      eveningDropTime: l.evening_drop_time,
      status: l.status,
      lat: l.latitude,
      lng: l.longitude
    }));

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    console.error('getAllLocations error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving locations.', error: err.message });
  }
};

exports.getLocationById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT l.*, r.route_number, r.route_name
      FROM locations l
      LEFT JOIN routes r ON l.route_id = r.id
      WHERE l.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Location not found.' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('getLocationById error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving location.', error: err.message });
  }
};

exports.createLocation = async (req, res) => {
  try {
    const { name, zone, distanceKm, distance, routeId, morningPickupTime, eveningDropTime, lat, lng } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Location name is required.' });
    }

    const cleanName = name.trim();
    const cleanZone = zone || 'Zone 1';
    const dist = parseFloat(distanceKm || distance || 10);
    const mTime = morningPickupTime || '07:45 AM';
    const eTime = eveningDropTime || '05:30 PM';
    const rId = routeId || null;

    // Check duplicate
    const [chk] = await db.query('SELECT id FROM locations WHERE name = ?', [cleanName]);
    if (chk.length > 0) {
      return res.status(409).json({ success: false, message: 'Location with this name already exists.' });
    }

    const [result] = await db.query(
      `INSERT INTO locations (name, zone, distance_km, route_id, morning_pickup_time, evening_drop_time, latitude, longitude, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [cleanName, cleanZone, dist, rId, mTime, eTime, lat || null, lng || null]
    );

    res.status(201).json({
      success: true,
      message: 'Pickup location created successfully in database!',
      locationId: result.insertId
    });
  } catch (err) {
    console.error('createLocation error:', err);
    res.status(500).json({ success: false, message: 'Server error creating location.', error: err.message });
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, zone, distanceKm, distance, routeId, morningPickupTime, eveningDropTime, status, lat, lng } = req.body;

    const [current] = await db.query('SELECT * FROM locations WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Location not found.' });
    }
    const loc = current[0];

    const finalName = name !== undefined ? name.trim() : loc.name;
    const finalZone = zone !== undefined ? zone : loc.zone;
    const finalDist = distanceKm !== undefined ? parseFloat(distanceKm) : (distance !== undefined ? parseFloat(distance) : loc.distance_km);
    const finalRoute = routeId !== undefined ? routeId : loc.route_id;
    const finalMTime = morningPickupTime !== undefined ? morningPickupTime : loc.morning_pickup_time;
    const finalETime = eveningDropTime !== undefined ? eveningDropTime : loc.evening_drop_time;
    const finalStatus = status !== undefined ? status : loc.status;
    const finalLat = lat !== undefined ? lat : loc.latitude;
    const finalLng = lng !== undefined ? lng : loc.longitude;

    await db.query(
      `UPDATE locations SET
        name = ?, zone = ?, distance_km = ?, route_id = ?,
        morning_pickup_time = ?, evening_drop_time = ?, status = ?,
        latitude = ?, longitude = ?
       WHERE id = ?`,
      [finalName, finalZone, finalDist, finalRoute, finalMTime, finalETime, finalStatus, finalLat, finalLng, id]
    );

    res.json({ success: true, message: 'Location updated successfully!' });
  } catch (err) {
    console.error('updateLocation error:', err);
    res.status(500).json({ success: false, message: 'Server error updating location.', error: err.message });
  }
};

exports.deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM locations WHERE id = ?', [id]);
    res.json({ success: true, message: 'Location deleted successfully.' });
  } catch (err) {
    console.error('deleteLocation error:', err);
    res.status(500).json({ success: false, message: 'Server error deleting location.', error: err.message });
  }
};
