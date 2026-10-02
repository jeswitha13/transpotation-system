const db = require('../config/db');
const { numberToWords } = require('../utils/numberToWords');
const { generateReceiptNumber, generateTransactionId } = require('../utils/codeGenerators');

/**
 * 1. Bus Fee Structure CRUD
 */
exports.getAllFeeStructures = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT fs.*, 
             r.route_number, r.route_name, r.distance_km AS actual_route_distance,
             b.bus_number, b.registration_number
      FROM fee_structures fs
      LEFT JOIN routes r ON fs.route_id = r.id
      LEFT JOIN buses b ON fs.bus_id = b.id
      ORDER BY fs.id DESC
    `);

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('getAllFeeStructures error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving fee structures.', error: err.message });
  }
};

exports.getFeeStructureById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT fs.*, 
             r.route_number, r.route_name, r.distance_km AS actual_route_distance,
             b.bus_number
      FROM fee_structures fs
      LEFT JOIN routes r ON fs.route_id = r.id
      LEFT JOIN buses b ON fs.bus_id = b.id
      WHERE fs.id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Fee structure not found.' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('getFeeStructureById error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving fee structure.', error: err.message });
  }
};

exports.createFeeStructure = async (req, res) => {
  try {
    const {
      route_id,
      routeId,
      bus_id,
      busId,
      academic_year,
      academicYear,
      semester,
      fee_calculation_type,
      feeCalculationType,
      fee_per_km,
      feePerKm,
      fixed_route_fee,
      fixedRouteFee,
      calculated_distance_km,
      distanceKm
    } = req.body;

    let finalRouteId = route_id || routeId || req.body.route;
    if (finalRouteId && isNaN(finalRouteId)) {
      const [r] = await db.query('SELECT id FROM routes WHERE route_number = ? OR route_name = ?', [finalRouteId, finalRouteId]);
      if (r.length > 0) finalRouteId = r[0].id;
    }

    let finalBusId = bus_id || busId || req.body.busNumber || req.body.bus_number || null;
    if (finalBusId && isNaN(finalBusId)) {
      const [b] = await db.query('SELECT id FROM buses WHERE bus_number = ? OR registration_number = ?', [finalBusId, finalBusId]);
      if (b.length > 0) finalBusId = b[0].id;
    }

    const finalAy = (academic_year || academicYear || '2026-27').trim();
    const finalSem = (semester || '1').trim();
    const finalType = (fee_calculation_type || feeCalculationType || 'FIXED_ROUTE').toUpperCase();

    if (!finalRouteId) {
      return res.status(400).json({ success: false, message: 'Route ID is required.' });
    }

    // Get route distance
    const [routes] = await db.query('SELECT distance_km, bus_id FROM routes WHERE id = ?', [finalRouteId]);
    if (routes.length === 0) {
      return res.status(404).json({ success: false, message: 'Route not found.' });
    }

    const routeDistance = parseFloat(calculated_distance_km || distanceKm || routes[0].distance_km || 0);
    const busLink = finalBusId || routes[0].bus_id;

    let finalFee = 0;
    const perKmRate = parseFloat(fee_per_km || feePerKm || 0);
    const fixedFeeAmount = parseFloat(fixed_route_fee || fixedRouteFee || req.body.feeAmount || req.body.fee_amount || req.body.fee || 0);

    if (finalType === 'PER_KM') {
      // Option A: Per Kilometer = distance * rate (rounded to nearest rupee)
      finalFee = Math.round(routeDistance * perKmRate);
    } else {
      // Option B: Fixed Route Fee
      finalFee = Math.round(fixedFeeAmount);
    }

    // Insert or update fee structure
    const [result] = await db.query(
      `INSERT INTO fee_structures (
        route_id, bus_id, academic_year, semester, fee_calculation_type,
        fee_per_km, fixed_route_fee, calculated_distance_km, final_fee, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      ON DUPLICATE KEY UPDATE
        bus_id = VALUES(bus_id),
        fee_calculation_type = VALUES(fee_calculation_type),
        fee_per_km = VALUES(fee_per_km),
        fixed_route_fee = VALUES(fixed_route_fee),
        calculated_distance_km = VALUES(calculated_distance_km),
        final_fee = VALUES(final_fee),
        status = 'active'`,
      [
        finalRouteId, busLink, finalAy, finalSem, finalType,
        perKmRate, fixedFeeAmount, routeDistance, finalFee
      ]
    );

    const feeStructureId = result.insertId || (await db.query(
      'SELECT id FROM fee_structures WHERE route_id = ? AND academic_year = ? AND semester = ?',
      [finalRouteId, finalAy, finalSem]
    ))[0][0].id;

    // Automatic Fee Update: Update fee records for all students assigned to this route!
    const [assignedStudents] = await db.query(
      'SELECT id FROM students WHERE assigned_route_id = ?',
      [finalRouteId]
    );

    for (const student of assignedStudents) {
      const [existingRecord] = await db.query(
        'SELECT * FROM student_fee_records WHERE student_id = ? AND academic_year = ? AND semester = ?',
        [student.id, finalAy, finalSem]
      );

      if (existingRecord.length > 0) {
        const paid = existingRecord[0].paid_amount;
        const late = existingRecord[0].late_fee;
        const pending = Math.max(0, (finalFee + late) - paid);
        const pStatus = pending <= 0 ? 'PAID' : (paid > 0 ? 'PARTIALLY PAID' : 'UNPAID');

        await db.query(
          `UPDATE student_fee_records SET
            fee_structure_id = ?, total_fee = ?, pending_amount = ?,
            total_payable = ?, payment_status = ?
           WHERE id = ?`,
          [feeStructureId, finalFee, pending, finalFee + late, pStatus, existingRecord[0].id]
        );
      } else {
        await db.query(
          `INSERT INTO student_fee_records (
            student_id, fee_structure_id, route_id, academic_year, semester,
            total_fee, paid_amount, pending_amount, late_fee, total_payable, payment_status
          ) VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, 0.00, ?, 'UNPAID')`,
          [student.id, feeStructureId, finalRouteId, finalAy, finalSem, finalFee, finalFee, finalFee]
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Bus fee structure saved and synchronized with assigned students!',
      data: {
        id: feeStructureId,
        routeId: finalRouteId,
        calculationType: finalType,
        distanceKm: routeDistance,
        finalFee
      }
    });
  } catch (err) {
    console.error('createFeeStructure error:', err);
    res.status(500).json({ success: false, message: 'Server error saving fee structure.', error: err.message });
  }
};

exports.updateFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      route_id,
      routeId,
      bus_id,
      busId,
      academic_year,
      academicYear,
      semester,
      fee_calculation_type,
      feeCalculationType,
      fee_per_km,
      feePerKm,
      fixed_route_fee,
      fixedRouteFee,
      calculated_distance_km,
      distanceKm,
      feeAmount,
      fee_amount,
      final_fee,
      status
    } = req.body;

    const [current] = await db.query('SELECT * FROM fee_structures WHERE id = ?', [id]);
    if (current.length === 0) {
      return res.status(404).json({ success: false, message: 'Fee structure not found.' });
    }

    const fs = current[0];
    const newRouteId = route_id || routeId || fs.route_id;
    const newBusId = bus_id !== undefined ? (bus_id || null) : (busId !== undefined ? (busId || null) : fs.bus_id);
    const newAy = (academic_year || academicYear || fs.academic_year || '2026-27').trim();
    const newSem = (semester !== undefined ? semester : fs.semester).toString().trim();
    const type = (fee_calculation_type || feeCalculationType || fs.fee_calculation_type).toUpperCase();
    const rate = (fee_per_km !== undefined ? fee_per_km : feePerKm) !== undefined ? parseFloat(fee_per_km || feePerKm) : fs.fee_per_km;
    const fixed = (fixed_route_fee !== undefined ? fixed_route_fee : (fixedRouteFee !== undefined ? fixedRouteFee : (feeAmount !== undefined ? feeAmount : (fee_amount !== undefined ? fee_amount : fs.fixed_route_fee))));
    const dist = (calculated_distance_km !== undefined ? calculated_distance_km : distanceKm) !== undefined ? parseFloat(calculated_distance_km || distanceKm) : fs.calculated_distance_km;
    const newStatus = status || fs.status;

    let computedFee = 0;
    if (type === 'PER_KM') {
      computedFee = Math.round(dist * rate);
    } else {
      computedFee = Math.round(parseFloat(fixed || feeAmount || fee_amount || final_fee || fs.final_fee || 0));
    }

    if (feeAmount !== undefined || fee_amount !== undefined || final_fee !== undefined) {
      computedFee = Math.round(parseFloat(feeAmount || fee_amount || final_fee));
    }

    await db.query(
      `UPDATE fee_structures SET
        route_id = ?, bus_id = ?, academic_year = ?, semester = ?,
        fee_calculation_type = ?, fee_per_km = ?, fixed_route_fee = ?,
        calculated_distance_km = ?, final_fee = ?, status = ?
       WHERE id = ?`,
      [newRouteId, newBusId, newAy, newSem, type, rate, fixed, dist, computedFee, newStatus, id]
    );

    // Synchronize assigned students' fee records
    const [assignedStudents] = await db.query(
      'SELECT id FROM students WHERE assigned_route_id = ?',
      [newRouteId]
    );

    for (const student of assignedStudents) {
      const [existingRecord] = await db.query(
        'SELECT * FROM student_fee_records WHERE student_id = ? AND academic_year = ? AND semester = ?',
        [student.id, newAy, newSem]
      );

      if (existingRecord.length > 0) {
        const paid = parseFloat(existingRecord[0].paid_amount || 0);
        const late = parseFloat(existingRecord[0].late_fee || 0);
        const totalPayable = computedFee + late;
        const pending = Math.max(0, totalPayable - paid);
        const pStatus = pending <= 0 ? 'PAID' : (paid > 0 ? 'PARTIALLY PAID' : 'PENDING');

        await db.query(
          `UPDATE student_fee_records SET
            fee_structure_id = ?, total_fee = ?, pending_amount = ?,
            total_payable = ?, payment_status = ?
           WHERE id = ?`,
          [id, computedFee, pending, totalPayable, pStatus, existingRecord[0].id]
        );
      }
    }

    res.json({
      success: true,
      message: 'Fee structure updated successfully and synchronized with student records!',
      data: {
        id,
        routeId: newRouteId,
        busId: newBusId,
        feeAmount: computedFee,
        academicYear: newAy,
        semester: newSem,
        status: newStatus
      }
    });
  } catch (err) {
    console.error('updateFeeStructure error:', err);
    res.status(500).json({ success: false, message: 'Server error updating fee structure.', error: err.message });
  }
};

exports.deleteFeeStructure = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM fee_structures WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Fee structure not found.' });
    }
    res.json({ success: true, message: 'Fee structure deleted successfully.' });
  } catch (err) {
    console.error('deleteFeeStructure error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete fee structure.', error: err.message });
  }
};

exports.getAllLateFees = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT lf.id, lf.student_fee_record_id, lf.amount AS late_fee, lf.reason, lf.applied_date, lf.status,
             sfr.student_id, sfr.semester, sfr.academic_year, sfr.total_fee, sfr.paid_amount, sfr.pending_amount,
             (sfr.pending_amount + lf.amount) AS total_payable,
             s.roll_number, s.name AS student_name, s.course, s.phone
      FROM late_fees lf
      JOIN student_fee_records sfr ON lf.student_fee_record_id = sfr.id
      JOIN students s ON sfr.student_id = s.id
      ORDER BY lf.id DESC
    `);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('getAllLateFees error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving late fees.', error: err.message });
  }
};

exports.getAllReceipts = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT r.id, r.receipt_number, r.amount, r.payment_mode, r.receipt_date, r.fee_particulars,
             p.transaction_id, p.payment_status,
             s.id AS student_id, s.name AS student_name, s.roll_number, s.course, s.phone
      FROM receipts r
      JOIN payments p ON r.payment_id = p.payment_id
      JOIN students s ON r.student_id = s.id
      ORDER BY r.id DESC
    `);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('getAllReceipts error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving receipts.', error: err.message });
  }
};


/**
 * 2. Student Fee Record for Student Dashboard
 * Returns complete route-specific fee, paid, pending, late fee, and payment status
 */
exports.getStudentFeeDetails = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Fetch student info
    let [students] = await db.query(
      `SELECT s.id, s.roll_number, s.name, s.course, s.assigned_route_id, s.assigned_bus_id,
              s.pickup_location_id,
              r.route_number, r.route_name, r.distance_km AS route_distance,
              b.bus_number,
              l.name AS pickup_name, l.distance_km AS pickup_distance
       FROM students s
       LEFT JOIN routes r ON s.assigned_route_id = r.id
       LEFT JOIN buses b ON s.assigned_bus_id = b.id
       LEFT JOIN locations l ON s.pickup_location_id = l.id
       WHERE s.id = ?
       LIMIT 1`,
      [studentId]
    );

    if (students.length === 0) {
      [students] = await db.query(
        `SELECT s.id, s.roll_number, s.name, s.course, s.assigned_route_id, s.assigned_bus_id,
                s.pickup_location_id,
                r.route_number, r.route_name, r.distance_km AS route_distance,
                b.bus_number,
                l.name AS pickup_name, l.distance_km AS pickup_distance
         FROM students s
         LEFT JOIN routes r ON s.assigned_route_id = r.id
         LEFT JOIN buses b ON s.assigned_bus_id = b.id
         LEFT JOIN locations l ON s.pickup_location_id = l.id
         WHERE s.user_id = ? OR UPPER(s.roll_number) = UPPER(?)
         LIMIT 1`,
        [studentId, studentId]
      );
    }

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const s = students[0];

    // Fetch student fee record
    let [records] = await db.query(
      `SELECT sfr.*, fs.fee_calculation_type, fs.fee_per_km, fs.fixed_route_fee, fs.calculated_distance_km
       FROM student_fee_records sfr
       LEFT JOIN fee_structures fs ON sfr.fee_structure_id = fs.id
       WHERE sfr.student_id = ?
       ORDER BY sfr.id DESC LIMIT 1`,
      [s.id]
    );

    let feeData = null;

    if (records.length > 0) {
      const rec = records[0];
      feeData = {
        id: rec.id,
        studentId: s.id,
        rollNumber: s.roll_number,
        studentName: s.name,
        academicYear: rec.academic_year,
        semester: rec.semester,
        routeNumber: s.route_number || 'Unassigned',
        routeName: s.route_name || 'No Route Assigned',
        busNumber: s.bus_number || 'Unassigned',
        distanceKm: rec.calculated_distance_km || s.route_distance || s.pickup_distance || 0,
        feeCalculationType: rec.fee_calculation_type || 'FIXED_ROUTE',
        totalFee: parseFloat(rec.total_fee),
        paidAmount: parseFloat(rec.paid_amount),
        pendingAmount: parseFloat(rec.pending_amount),
        lateFee: parseFloat(rec.late_fee),
        totalPayable: parseFloat(rec.total_payable),
        paymentStatus: rec.payment_status,
        dueDate: rec.due_date
      };
    } else if (s.assigned_route_id) {
      // Auto generate on the fly if assigned route exists
      const [feeStructures] = await db.query(
        `SELECT * FROM fee_structures WHERE route_id = ? AND status = 'active' LIMIT 1`,
        [s.assigned_route_id]
      );

      let fsId = null;
      let totalFee = 15000.00;
      let calcType = 'FIXED_ROUTE';
      let dist = s.route_distance || 18.7;
      let ay = '2026-27';
      let sem = '1';

      if (feeStructures.length > 0) {
        const fs = feeStructures[0];
        fsId = fs.id;
        totalFee = parseFloat(fs.final_fee);
        calcType = fs.fee_calculation_type;
        dist = fs.calculated_distance_km;
        ay = fs.academic_year;
        sem = fs.semester;
      }

      const [ins] = await db.query(
        `INSERT INTO student_fee_records (
          student_id, fee_structure_id, route_id, academic_year, semester,
          total_fee, paid_amount, pending_amount, late_fee, total_payable, payment_status
        ) VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, 0.00, ?, 'UNPAID')`,
        [s.id, fsId, s.assigned_route_id, ay, sem, totalFee, totalFee, totalFee]
      );

      feeData = {
        id: ins.insertId,
        studentId: s.id,
        rollNumber: s.roll_number,
        studentName: s.name,
        academicYear: ay,
        semester: sem,
        routeNumber: s.route_number,
        routeName: s.route_name,
        busNumber: s.bus_number,
        distanceKm: dist,
        feeCalculationType: calcType,
        totalFee,
        paidAmount: 0,
        pendingAmount: totalFee,
        lateFee: 0,
        totalPayable: totalFee,
        paymentStatus: 'UNPAID',
        dueDate: null
      };
    } else {
      // Route unassigned
      feeData = {
        id: null,
        studentId: s.id,
        rollNumber: s.roll_number,
        studentName: s.name,
        academicYear: '2026-27',
        semester: '1',
        routeNumber: 'Unassigned',
        routeName: 'Pending Route Assignment by Transport Office',
        busNumber: 'Unassigned',
        distanceKm: 0,
        feeCalculationType: 'N/A',
        totalFee: 0,
        paidAmount: 0,
        pendingAmount: 0,
        lateFee: 0,
        totalPayable: 0,
        paymentStatus: 'UNASSIGNED',
        dueDate: null
      };
    }

    res.json({ success: true, data: feeData });
  } catch (err) {
    console.error('getStudentFeeDetails error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving fee details.', error: err.message });
  }
};

/**
 * 3. All Student Fee Records for Admin Fee Management
 */
exports.getAllStudentFeeRecords = async (req, res) => {
  try {
    const { status, academicYear, search } = req.query;

    let query = `
      SELECT sfr.*, 
             s.name AS student_name, s.roll_number, s.course, s.phone,
             r.route_number, r.route_name,
             b.bus_number
      FROM student_fee_records sfr
      JOIN students s ON sfr.student_id = s.id
      LEFT JOIN routes r ON sfr.route_id = r.id
      LEFT JOIN buses b ON s.assigned_bus_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND LOWER(sfr.payment_status) = LOWER(?)`;
      params.push(status);
    }

    if (academicYear) {
      query += ` AND sfr.academic_year = ?`;
      params.push(academicYear);
    }

    if (search) {
      const q = `%${search.trim().toLowerCase()}%`;
      query += ` AND (LOWER(s.name) LIKE ? OR LOWER(s.roll_number) LIKE ? OR LOWER(s.phone) LIKE ?)`;
      params.push(q, q, q);
    }

    query += ` ORDER BY sfr.id DESC`;

    const [rows] = await db.query(query, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('getAllStudentFeeRecords error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving student fee records.', error: err.message });
  }
};

/**
 * 4. Apply Late Fee / Fine
 */
exports.applyLateFee = async (req, res) => {
  try {
    const { recordId, amount, reason } = req.body;
    const fineAmount = parseFloat(amount);

    if (!recordId || isNaN(fineAmount) || fineAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid fee record ID and fine amount are required.' });
    }

    const [records] = await db.query('SELECT * FROM student_fee_records WHERE id = ?', [recordId]);
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Fee record not found.' });
    }

    const rec = records[0];
    const newLate = parseFloat(rec.late_fee) + fineAmount;
    const newTotalPayable = parseFloat(rec.total_payable) + fineAmount;
    const newPending = Math.max(0, newTotalPayable - parseFloat(rec.paid_amount));
    const newStatus = newPending <= 0 ? 'PAID' : (parseFloat(rec.paid_amount) > 0 ? 'PARTIALLY PAID' : 'UNPAID');

    await db.query(
      `UPDATE student_fee_records SET
        late_fee = ?, total_payable = ?, pending_amount = ?, payment_status = ?
       WHERE id = ?`,
      [newLate, newTotalPayable, newPending, newStatus, recordId]
    );

    await db.query(
      `INSERT INTO late_fees (student_fee_record_id, amount, reason, applied_date, status)
       VALUES (?, ?, ?, CURDATE(), 'applied')`,
      [recordId, fineAmount, reason || 'Late transportation fee payment fine']
    );

    // Notify student
    const [stu] = await db.query('SELECT user_id, name FROM students WHERE id = ?', [rec.student_id]);
    if (stu.length > 0 && stu[0].user_id) {
      await db.query(
        `INSERT INTO notifications (user_id, target_role, title, message, category)
         VALUES (?, 'student', 'Late Fee Imposed', ?, 'warning')`,
        [stu[0].user_id, `A late fine of ₹${fineAmount} has been applied to your transit fee: ${reason || 'Late payment fine'}.`]
      );
    }

    res.json({ success: true, message: `Late fine of ₹${fineAmount} applied successfully.` });
  } catch (err) {
    console.error('applyLateFee error:', err);
    res.status(500).json({ success: false, message: 'Server error applying late fee.', error: err.message });
  }
};

/**
 * 5. Auto-Lookup Student Details (Name, Semester, Bus, Route, Fee/Pending Balance)
 */
exports.lookupStudent = async (req, res) => {
  try {
    const { query } = req.params;
    if (!query) return res.status(400).json({ success: false, message: 'Student ID or Roll Number is required.' });

    const clean = query.trim();
    const [students] = await db.query(
      `SELECT s.id, s.roll_number, s.name, s.course, s.semester, s.year_of_study, s.phone, s.email,
              s.assigned_route_id, s.assigned_bus_id,
              r.route_number, r.route_name,
              b.bus_number
       FROM students s
       LEFT JOIN routes r ON s.assigned_route_id = r.id
       LEFT JOIN buses b ON s.assigned_bus_id = b.id
       WHERE UPPER(s.roll_number) = UPPER(?) OR s.id = ?
       LIMIT 1`,
      [clean, isNaN(clean) ? -1 : parseInt(clean)]
    );

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found in database.' });
    }

    const s = students[0];

    // Fetch latest fee record for this student
    const [feeRecords] = await db.query(
      `SELECT sfr.*, r.route_number, r.route_name, b.bus_number
       FROM student_fee_records sfr
       JOIN students s ON sfr.student_id = s.id
       LEFT JOIN routes r ON sfr.route_id = r.id
       LEFT JOIN buses b ON s.assigned_bus_id = b.id
       WHERE sfr.student_id = ?
       ORDER BY sfr.id DESC LIMIT 1`,
      [s.id]
    );

    let feeRecord = null;
    if (feeRecords.length > 0) {
      const fr = feeRecords[0];
      feeRecord = {
        id: fr.id,
        academicYear: fr.academic_year,
        semester: fr.semester,
        totalFee: parseFloat(fr.total_fee || 0),
        paidAmount: parseFloat(fr.paid_amount || 0),
        pendingAmount: parseFloat(fr.pending_amount || 0),
        lateFee: parseFloat(fr.late_fee || 0),
        totalPayable: parseFloat(fr.total_payable || 0),
        paymentStatus: fr.payment_status
      };
    }

    res.json({
      success: true,
      data: {
        studentDbId: s.id,
        studentId: s.roll_number,
        studentName: s.name,
        course: s.course,
        department: s.course,
        semester: s.semester || '1',
        year: s.year_of_study,
        phone: s.phone,
        email: s.email,
        assignedBusId: s.assigned_bus_id,
        busNumber: s.bus_number || 'Unassigned',
        assignedRouteId: s.assigned_route_id,
        route: s.route_number ? `${s.route_number} - ${s.route_name}` : 'Unassigned',
        routeNumber: s.route_number || 'Unassigned',
        feeRecord
      }
    });
  } catch (err) {
    console.error('lookupStudent error:', err);
    res.status(500).json({ success: false, message: 'Error looking up student.', error: err.message });
  }
};

/**
 * 6. Create Student Fee Record
 */
exports.createStudentFeeRecord = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      studentId, rollNumber, student_id,
      semester,
      busId, busNumber,
      routeId, route,
      feeAmount, totalFee, total_fee,
      academicYear, academic_year
    } = req.body;

    const roll = (studentId || rollNumber || student_id || '').trim();
    if (!roll) {
      return res.status(400).json({ success: false, message: 'Student ID / Roll Number is required.' });
    }

    // Lookup student by roll or ID
    const [students] = await connection.query(
      'SELECT id, name, semester, assigned_route_id, assigned_bus_id FROM students WHERE UPPER(roll_number) = UPPER(?) OR id = ?',
      [roll, isNaN(roll) ? -1 : parseInt(roll)]
    );

    let student = students.length > 0 ? students[0] : null;
    const providedName = (req.body.studentName || req.body.student_name || req.body.name || '').trim();

    const finalSemRaw = (semester || (student ? student.semester : '1')).toString().trim();
    // Normalize Roman numerals like IV -> 4 if needed
    const romanMap = { 'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5', 'VI': '6', 'VII': '7', 'VIII': '8' };
    const finalSem = romanMap[finalSemRaw.toUpperCase()] || finalSemRaw;

    const finalAy = (academicYear || academic_year || '2026-27').trim();

    // Resolve route and bus
    let finalRouteId = routeId;
    if (!finalRouteId && route) {
      const [r] = await connection.query('SELECT id FROM routes WHERE route_number = ? OR route_name = ? OR id = ?', [route, route, route]);
      if (r.length > 0) finalRouteId = r[0].id;
    }
    if (!finalRouteId && student) finalRouteId = student.assigned_route_id;

    let finalBusId = busId;
    if (!finalBusId && busNumber) {
      const [b] = await connection.query('SELECT id FROM buses WHERE bus_number = ? OR registration_number = ? OR id = ?', [busNumber, busNumber, busNumber]);
      if (b.length > 0) finalBusId = b[0].id;
    }
    if (!finalBusId && student) finalBusId = student.assigned_bus_id;

    if (!student) {
      const sName = providedName || roll;
      const [insS] = await connection.query(
        'INSERT INTO students (roll_number, name, semester, assigned_route_id, assigned_bus_id) VALUES (?, ?, ?, ?, ?)',
        [roll, sName, finalSem, finalRouteId || null, finalBusId || null]
      );
      student = { id: insS.insertId, name: sName, semester: finalSem, assigned_route_id: finalRouteId, assigned_bus_id: finalBusId };
    } else if (providedName && providedName !== student.name) {
      await connection.query('UPDATE students SET name = ?, semester = ? WHERE id = ?', [providedName, finalSem, student.id]);
      student.name = providedName;
    }

    const finalFee = parseFloat(feeAmount !== undefined ? feeAmount : (totalFee !== undefined ? totalFee : (total_fee !== undefined ? total_fee : 0)));
    if (isNaN(finalFee) || finalFee < 0) {
      return res.status(400).json({ success: false, message: 'Valid Fee Amount is required.' });
    }

    await connection.beginTransaction();

    // Update student's assigned bus and route if provided
    if (finalRouteId || finalBusId) {
      await connection.query(
        'UPDATE students SET assigned_route_id = COALESCE(?, assigned_route_id), assigned_bus_id = COALESCE(?, assigned_bus_id) WHERE id = ?',
        [finalRouteId, finalBusId, student.id]
      );
    }

    // Check existing fee record
    const [existing] = await connection.query(
      'SELECT * FROM student_fee_records WHERE student_id = ? AND academic_year = ? AND semester = ?',
      [student.id, finalAy, finalSem]
    );

    let feeRecordId = null;
    if (existing.length > 0) {
      const ex = existing[0];
      const paid = parseFloat(ex.paid_amount || 0);
      const late = parseFloat(ex.late_fee || 0);
      const totalPayable = finalFee + late;
      const pending = Math.max(0, totalPayable - paid);
      const status = pending <= 0 ? 'PAID' : (paid > 0 ? 'PARTIALLY PAID' : 'PENDING');

      await connection.query(
        `UPDATE student_fee_records SET
          route_id = ?, total_fee = ?, pending_amount = ?, total_payable = ?, payment_status = ?
         WHERE id = ?`,
        [finalRouteId, finalFee, pending, totalPayable, status, ex.id]
      );
      feeRecordId = ex.id;
    } else {
      const [ins] = await connection.query(
        `INSERT INTO student_fee_records (
          student_id, route_id, academic_year, semester,
          total_fee, paid_amount, pending_amount, late_fee, total_payable, payment_status
        ) VALUES (?, ?, ?, ?, ?, 0.00, ?, 0.00, ?, 'PENDING')`,
        [student.id, finalRouteId, finalAy, finalSem, finalFee, finalFee, finalFee]
      );
      feeRecordId = ins.insertId;
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Student fee record saved successfully in database!',
      data: {
        id: feeRecordId,
        studentId: roll,
        feeAmount: finalFee,
        semester: finalSem,
        academicYear: finalAy
      }
    });
  } catch (err) {
    await connection.rollback();
    console.error('createStudentFeeRecord error:', err);
    res.status(500).json({ success: false, message: 'Server error saving student fee record.', error: err.message });
  } finally {
    connection.release();
  }
};

/**
 * 7. Update Student Fee Record
 */
exports.updateStudentFeeRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { feeAmount, totalFee, total_fee, semester, routeId, busId, academicYear } = req.body;

    const [records] = await db.query('SELECT * FROM student_fee_records WHERE id = ?', [id]);
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Student fee record not found.' });
    }

    const rec = records[0];
    const newTotalFee = parseFloat(feeAmount !== undefined ? feeAmount : (totalFee !== undefined ? totalFee : (total_fee !== undefined ? total_fee : rec.total_fee)));
    const newSem = (semester || rec.semester || '1').toString().trim();
    const newAy = (academicYear || rec.academic_year || '2026-27').trim();
    const newRouteId = routeId || rec.route_id;

    const paid = parseFloat(rec.paid_amount || 0);
    const late = parseFloat(rec.late_fee || 0);
    const totalPayable = newTotalFee + late;
    const pending = Math.max(0, totalPayable - paid);
    const status = pending <= 0 ? 'PAID' : (paid > 0 ? 'PARTIALLY PAID' : 'PENDING');

    await db.query(
      `UPDATE student_fee_records SET
        total_fee = ?, semester = ?, academic_year = ?, route_id = ?,
        total_payable = ?, pending_amount = ?, payment_status = ?
       WHERE id = ?`,
      [newTotalFee, newSem, newAy, newRouteId, totalPayable, pending, status, id]
    );

    res.json({
      success: true,
      message: 'Student fee record updated successfully in database!',
      data: { id, totalFee: newTotalFee, totalPayable, pendingAmount: pending, paymentStatus: status }
    });
  } catch (err) {
    console.error('updateStudentFeeRecord error:', err);
    res.status(500).json({ success: false, message: 'Server error updating student fee record.', error: err.message });
  }
};

/**
 * 8. Delete Student Fee Record
 */
exports.deleteStudentFeeRecord = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM late_fees WHERE student_fee_record_id = ?', [id]);
    const [result] = await db.query('DELETE FROM student_fee_records WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Student fee record not found.' });
    }
    res.json({ success: true, message: 'Student fee record deleted successfully from database.' });
  } catch (err) {
    console.error('deleteStudentFeeRecord error:', err);
    res.status(500).json({ success: false, message: 'Server error deleting student fee record.', error: err.message });
  }
};

/**
 * 9. Admin Process Payment & Auto-Generate Receipt
 */
exports.adminProcessPayment = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const {
      studentId, rollNumber, student_id,
      amount, paymentAmount,
      paymentMethod, payment_method,
      transactionId, transaction_id,
      paymentStatus, payment_status,
      paymentDate, payment_date,
      academicYear
    } = req.body;

    const roll = (studentId || rollNumber || student_id || '').trim();
    if (!roll) {
      return res.status(400).json({ success: false, message: 'Student ID / Roll Number is required.' });
    }

    const payAmount = parseFloat(amount || paymentAmount);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment Amount must be greater than zero.' });
    }

    const [students] = await connection.query(
      'SELECT id, name, roll_number, user_id FROM students WHERE UPPER(roll_number) = UPPER(?) OR id = ?',
      [roll, isNaN(roll) ? -1 : parseInt(roll)]
    );

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: `Student with ID "${roll}" not found in database.` });
    }

    const student = students[0];

    const [feeRecords] = await connection.query(
      'SELECT * FROM student_fee_records WHERE student_id = ? ORDER BY id DESC LIMIT 1',
      [student.id]
    );

    if (feeRecords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fee record found for this student. Please assign a fee in Student Fee Records first.'
      });
    }

    const feeRecord = feeRecords[0];
    const currentPending = parseFloat(feeRecord.pending_amount || 0);

    // Validation: cannot exceed pending amount
    if (currentPending > 0 && payAmount > currentPending) {
      return res.status(400).json({
        success: false,
        message: `Payment amount of ₹${payAmount.toLocaleString('en-IN')} exceeds current pending balance of ₹${currentPending.toLocaleString('en-IN')}.`
      });
    }

    const finalMethod = (paymentMethod || payment_method || 'UPI').trim();
    const finalStatus = (paymentStatus || payment_status || 'SUCCESSFUL').trim();
    const pDate = (paymentDate || payment_date) ? new Date(paymentDate || payment_date) : new Date();
    const ay = academicYear || feeRecord.academic_year || '2026-27';

    await connection.beginTransaction();

    const txnId = (transactionId || transaction_id || '').trim() || await generateTransactionId();

    const [payResult] = await connection.query(
      `INSERT INTO payments (
        student_id, fee_record_id, amount, payment_method, transaction_id, payment_status, payment_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [student.id, feeRecord.id, payAmount, finalMethod, txnId, finalStatus, pDate]
    );
    const paymentId = payResult.insertId;

    // Generate unique 11-char receipt number
    const receiptNo = await generateReceiptNumber(ay);
    const amountInWords = numberToWords(payAmount);

    await connection.query(
      `INSERT INTO receipts (
        payment_id, student_id, receipt_number, fee_particulars, amount, amount_in_words, payment_mode, receipt_date
      ) VALUES (?, ?, ?, 'Annual Transportation Fee Payment', ?, ?, ?, ?)`,
      [paymentId, student.id, receiptNo, payAmount, amountInWords, finalMethod, pDate]
    );

    // Recalculate balances
    const newPaid = parseFloat(feeRecord.paid_amount || 0) + payAmount;
    const totalDue = parseFloat(feeRecord.total_payable || feeRecord.total_fee);
    const newPending = Math.max(0, totalDue - newPaid);
    const newPaymentStatus = newPending <= 0 ? 'PAID' : (newPaid > 0 ? 'PARTIALLY PAID' : 'PENDING');

    await connection.query(
      `UPDATE student_fee_records SET
        paid_amount = ?, pending_amount = ?, payment_status = ?
       WHERE id = ?`,
      [newPaid, newPending, newPaymentStatus, feeRecord.id]
    );

    // Send notification to student
    if (student.user_id) {
      await connection.query(
        `INSERT INTO notifications (user_id, target_role, title, message, category)
         VALUES (?, 'student', 'Fee Payment Recorded', ?, 'success')`,
        [student.user_id, `Payment of ₹${payAmount.toLocaleString('en-IN')} received via ${finalMethod}. Receipt No: ${receiptNo}.`]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Payment processed and saved to database successfully!',
      data: {
        paymentId,
        transactionId: txnId,
        receiptNumber: receiptNo,
        studentId: student.roll_number,
        studentName: student.name,
        amount: payAmount,
        paymentMethod: finalMethod,
        paymentStatus: finalStatus,
        paymentDate: pDate.toISOString(),
        totalFee: feeRecord.total_fee,
        paidAmount: newPaid,
        pendingAmount: newPending,
        calculatedStatus: newPaymentStatus
      }
    });
  } catch (err) {
    await connection.rollback();
    console.error('adminProcessPayment error:', err);
    res.status(500).json({ success: false, message: 'Server error processing payment.', error: err.message });
  } finally {
    connection.release();
  }
};

/**
 * 10. Generate Receipt for a Payment
 */
exports.adminGenerateReceipt = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { paymentId, transactionId, studentId } = req.body;

    let query = `
      SELECT p.*, s.roll_number, s.name AS student_name, s.course, sfr.academic_year
      FROM payments p
      JOIN students s ON p.student_id = s.id
      LEFT JOIN student_fee_records sfr ON p.fee_record_id = sfr.id
      WHERE 1=1
    `;
    const params = [];

    if (paymentId) {
      query += ' AND p.payment_id = ?';
      params.push(paymentId);
    } else if (transactionId) {
      query += ' AND p.transaction_id = ?';
      params.push(transactionId);
    } else if (studentId) {
      query += ' AND (UPPER(s.roll_number) = UPPER(?) OR s.id = ?) ORDER BY p.payment_id DESC LIMIT 1';
      params.push(studentId, isNaN(studentId) ? -1 : parseInt(studentId));
    } else {
      return res.status(400).json({ success: false, message: 'Payment ID, Transaction ID, or Student ID required.' });
    }

    const [payments] = await connection.query(query, params);
    if (payments.length === 0) {
      return res.status(404).json({ success: false, message: 'No matching payment found in database.' });
    }

    const pay = payments[0];

    // Check if receipt already exists
    const [existing] = await connection.query('SELECT * FROM receipts WHERE payment_id = ?', [pay.payment_id]);
    if (existing.length > 0) {
      return res.json({
        success: true,
        message: 'Existing receipt retrieved from database.',
        data: {
          ...existing[0],
          transactionId: pay.transaction_id,
          studentName: pay.student_name,
          studentRollNumber: pay.roll_number,
          course: pay.course
        }
      });
    }

    // Generate new receipt
    const ay = pay.academic_year || '2026-27';
    const receiptNo = await generateReceiptNumber(ay);
    const amountInWords = numberToWords(pay.amount);

    const [ins] = await connection.query(
      `INSERT INTO receipts (
        payment_id, student_id, receipt_number, fee_particulars, amount, amount_in_words, payment_mode, receipt_date
      ) VALUES (?, ?, ?, 'Annual Transportation Fee', ?, ?, ?, NOW())`,
      [pay.payment_id, pay.student_id, receiptNo, pay.amount, amountInWords, pay.payment_method]
    );

    res.status(201).json({
      success: true,
      message: 'Official receipt generated and saved in MySQL!',
      data: {
        id: ins.insertId,
        payment_id: pay.payment_id,
        receipt_number: receiptNo,
        transactionId: pay.transaction_id,
        studentId: pay.roll_number,
        studentName: pay.student_name,
        amount: pay.amount,
        amount_in_words: amountInWords,
        payment_mode: pay.payment_method,
        receipt_date: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('adminGenerateReceipt error:', err);
    res.status(500).json({ success: false, message: 'Server error generating receipt.', error: err.message });
  } finally {
    connection.release();
  }
};

/**
 * 11. Update Late Fee
 */
exports.updateLateFee = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;
    const newAmount = parseFloat(amount);

    if (isNaN(newAmount) || newAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid fine amount is required.' });
    }

    const [lateFees] = await connection.query('SELECT * FROM late_fees WHERE id = ?', [id]);
    if (lateFees.length === 0) {
      return res.status(404).json({ success: false, message: 'Late fee record not found.' });
    }
    const lf = lateFees[0];
    const diff = newAmount - parseFloat(lf.amount);

    await connection.beginTransaction();

    await connection.query('UPDATE late_fees SET amount = ?, reason = ? WHERE id = ?', [newAmount, reason || lf.reason, id]);

    // Recalculate student fee record
    const [recs] = await connection.query('SELECT * FROM student_fee_records WHERE id = ?', [lf.student_fee_record_id]);
    if (recs.length > 0) {
      const rec = recs[0];
      const newLate = Math.max(0, parseFloat(rec.late_fee || 0) + diff);
      const newTotalPayable = parseFloat(rec.total_fee) + newLate;
      const newPending = Math.max(0, newTotalPayable - parseFloat(rec.paid_amount || 0));
      const status = newPending <= 0 ? 'PAID' : (parseFloat(rec.paid_amount) > 0 ? 'PARTIALLY PAID' : 'PENDING');

      await connection.query(
        'UPDATE student_fee_records SET late_fee = ?, total_payable = ?, pending_amount = ?, payment_status = ? WHERE id = ?',
        [newLate, newTotalPayable, newPending, status, rec.id]
      );
    }

    await connection.commit();
    res.json({ success: true, message: 'Late fee updated and synchronized with student fee record.' });
  } catch (err) {
    await connection.rollback();
    console.error('updateLateFee error:', err);
    res.status(500).json({ success: false, message: 'Server error updating late fee.', error: err.message });
  } finally {
    connection.release();
  }
};

/**
 * 12. Delete Late Fee
 */
exports.deleteLateFee = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const [lateFees] = await connection.query('SELECT * FROM late_fees WHERE id = ?', [id]);
    if (lateFees.length === 0) {
      return res.status(404).json({ success: false, message: 'Late fee record not found.' });
    }
    const lf = lateFees[0];

    await connection.beginTransaction();

    await connection.query('DELETE FROM late_fees WHERE id = ?', [id]);

    // Adjust student fee record
    const [recs] = await connection.query('SELECT * FROM student_fee_records WHERE id = ?', [lf.student_fee_record_id]);
    if (recs.length > 0) {
      const rec = recs[0];
      const newLate = Math.max(0, parseFloat(rec.late_fee || 0) - parseFloat(lf.amount));
      const newTotalPayable = parseFloat(rec.total_fee) + newLate;
      const newPending = Math.max(0, newTotalPayable - parseFloat(rec.paid_amount || 0));
      const status = newPending <= 0 ? 'PAID' : (parseFloat(rec.paid_amount) > 0 ? 'PARTIALLY PAID' : 'PENDING');

      await connection.query(
        'UPDATE student_fee_records SET late_fee = ?, total_payable = ?, pending_amount = ?, payment_status = ? WHERE id = ?',
        [newLate, newTotalPayable, newPending, status, rec.id]
      );
    }

    await connection.commit();
    res.json({ success: true, message: 'Late fee removed and pending balance recalculated.' });
  } catch (err) {
    await connection.rollback();
    console.error('deleteLateFee error:', err);
    res.status(500).json({ success: false, message: 'Server error deleting late fee.', error: err.message });
  } finally {
    connection.release();
  }
};
