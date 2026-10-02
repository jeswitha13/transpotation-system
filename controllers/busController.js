const db = require('../config/db');

exports.getAllBuses = async (req, res) => {
  try {
    const [buses] = await db.query(`
      SELECT b.*,
             d.id AS driver_id, d.name AS driver_name, d.phone AS driver_phone,
             r.id AS route_id, r.route_number, r.route_name,
             (SELECT COUNT(*) FROM students s WHERE s.assigned_bus_id = b.id) AS occupied_seats
      FROM buses b
      LEFT JOIN drivers d ON b.id = d.assigned_bus_id
      LEFT JOIN routes r ON b.id = r.bus_id
      ORDER BY b.id ASC
    `);

    const formatted = buses.map(b => ({
      id: b.id,
      busNumber: b.bus_number,
      regNumber: b.registration_number,
      capacity: b.capacity,
      occupied: b.occupied_seats,
      status: b.status,
      speed: b.speed || '0 km/h',
      fuelLevel: b.fuel_level || '80%',
      lastMaintenance: b.last_maintenance,
      nextService: b.next_service,
      driverId: b.driver_id || null,
      driverName: b.driver_name || 'Unassigned',
      driverPhone: b.driver_phone || '-',
      routeId: b.route_id || null,
      routeName: b.route_number ? `${b.route_number} - ${b.route_name}` : 'Unassigned Route'
    }));

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    console.error('getAllBuses error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving buses.', error: err.message });
  }
};

exports.getBusById = async (req, res) => {
  try {
    const { id } = req.params;
    const [buses] = await db.query(`
      SELECT b.*,
             d.id AS driver_id, d.name AS driver_name, d.phone AS driver_phone,
             r.id AS route_id, r.route_number, r.route_name,
             (SELECT COUNT(*) FROM students s WHERE s.assigned_bus_id = b.id) AS occupied_seats
      FROM buses b
      LEFT JOIN drivers d ON b.id = d.assigned_bus_id
      LEFT JOIN routes r ON b.id = r.bus_id
      WHERE b.id = ? OR b.bus_number = ?
    `, [id, id]);

    if (buses.length === 0) {
      return res.status(404).json({ success: false, message: 'Bus not found.' });
    }

    const b = buses[0];
    res.json({
      success: true,
      data: {
        id: b.id,
        busNumber: b.bus_number,
        regNumber: b.registration_number,
        capacity: b.capacity,
        occupied: b.occupied_seats,
        status: b.status,
        speed: b.speed,
        fuelLevel: b.fuel_level,
        lastMaintenance: b.last_maintenance,
        nextService: b.next_service,
        driverId: b.driver_id,
        driverName: b.driver_name || 'Unassigned',
        driverPhone: b.driver_phone || '-',
        routeId: b.route_id,
        routeName: b.route_number ? `${b.route_number} - ${b.route_name}` : 'Unassigned'
      }
    });
  } catch (err) {
    console.error('getBusById error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving bus.', error: err.message });
  }
};

exports.createBus = async (req, res) => {
  try {
    const { busNumber, bus_number, regNumber, registrationNumber, registration_number, capacity, status, fuelLevel } = req.body;
    const bNum = (busNumber || bus_number || '').trim();
    const bReg = (regNumber || registrationNumber || registration_number || '').trim();
    const cap = parseInt(capacity, 10) || 50;
    const stat = status || 'active';

    if (!bNum || !bReg) {
      return res.status(400).json({ success: false, message: 'Bus number and registration number are required.' });
    }

    // Check duplicate
    const [chk] = await db.query(
      'SELECT id FROM buses WHERE bus_number = ? OR registration_number = ?',
      [bNum, bReg]
    );
    if (chk.length > 0) {
      return res.status(409).json({ success: false, message: 'Bus number or registration number already exists.' });
    }

    const [resBus] = await db.query(
      `INSERT INTO buses (bus_number, registration_number, capacity, status, speed, fuel_level)
       VALUES (?, ?, ?, ?, '0 km/h', ?)`,
      [bNum, bReg, cap, stat, fuelLevel || '80%']
    );

    res.status(201).json({
      success: true,
      message: 'Bus added to fleet successfully!',
      busId: resBus.insertId
    });
  } catch (err) {
    console.error('createBus error:', err);
    res.status(500).json({ success: false, message: 'Server error creating bus.', error: err.message });
  }
};

exports.updateBus = async (req, res) => {
  try {
    const { id } = req.params;
    const { busNumber, regNumber, capacity, status, speed, fuelLevel, driverId, routeId } = req.body;

    const [current] = await db.query('SELECT * FROM buses WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Bus not found.' });
    }
    const b = current[0];

    const finalNum = busNumber !== undefined ? busNumber.trim() : b.bus_number;
    const finalReg = regNumber !== undefined ? regNumber.trim() : b.registration_number;
    const finalCap = capacity !== undefined ? parseInt(capacity, 10) : b.capacity;
    const finalStatus = status !== undefined ? status : b.status;
    const finalSpeed = speed !== undefined ? speed : b.speed;
    const finalFuel = fuelLevel !== undefined ? fuelLevel : b.fuel_level;

    await db.query(
      `UPDATE buses SET
        bus_number = ?, registration_number = ?, capacity = ?,
        status = ?, speed = ?, fuel_level = ?
       WHERE id = ?`,
      [finalNum, finalReg, finalCap, finalStatus, finalSpeed, finalFuel, id]
    );

    // If driver assigned, update driver
    if (driverId !== undefined) {
      if (driverId) {
        await db.query('UPDATE drivers SET assigned_bus_id = ? WHERE id = ?', [id, driverId]);
      } else {
        await db.query('UPDATE drivers SET assigned_bus_id = NULL WHERE assigned_bus_id = ?', [id]);
      }
    }

    // If route assigned, update route
    if (routeId !== undefined) {
      if (routeId) {
        await db.query('UPDATE routes SET bus_id = ? WHERE id = ?', [id, routeId]);
      } else {
        await db.query('UPDATE routes SET bus_id = NULL WHERE bus_id = ?', [id]);
      }
    }

    res.json({ success: true, message: 'Bus details updated successfully!' });
  } catch (err) {
    console.error('updateBus error:', err);
    res.status(500).json({ success: false, message: 'Server error updating bus.', error: err.message });
  }
};

exports.deleteBus = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM buses WHERE id = ?', [id]);
    res.json({ success: true, message: 'Bus deleted successfully.' });
  } catch (err) {
    console.error('deleteBus error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete bus.', error: err.message });
  }
};
