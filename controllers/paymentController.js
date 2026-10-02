const db = require('../config/db');
const { numberToWords } = require('../utils/numberToWords');
const {
  generateReceiptNumber,
  generateTransactionId,
  isValidReceiptNumber
} = require('../utils/codeGenerators');

/**
 * 1. Process Online Payment (UPI / PhonePe Demo or Card Demo)
 */
exports.processPayment = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { studentId, student_id, feeRecordId, fee_record_id, amount, paymentMethod, payment_method, academicYear } = req.body;

    // Use authenticated student if available to prevent spoofing
    let effectiveStudentId = studentId || student_id;
    if (req.user && req.user.role === 'student' && req.user.studentId) {
      effectiveStudentId = req.user.studentId;
    }

    if (!effectiveStudentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required.' });
    }

    // Look up student from DB
    const [students] = await connection.query(
      `SELECT s.*, r.route_number, r.route_name, r.academic_year AS route_ay
       FROM students s
       LEFT JOIN routes r ON s.assigned_route_id = r.id
       WHERE s.id = ?`,
      [effectiveStudentId]
    );

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }
    const student = students[0];

    // Look up or auto-create Fee Record
    let recordId = feeRecordId || fee_record_id;
    let feeRecord = null;

    if (recordId) {
      const [recs] = await connection.query('SELECT * FROM student_fee_records WHERE id = ?', [recordId]);
      if (recs.length > 0) feeRecord = recs[0];
    }

    if (!feeRecord) {
      const [recs] = await connection.query(
        'SELECT * FROM student_fee_records WHERE student_id = ? ORDER BY id DESC LIMIT 1',
        [student.id]
      );
      if (recs.length > 0) {
        feeRecord = recs[0];
        recordId = feeRecord.id;
      }
    }

    if (!feeRecord) {
      return res.status(400).json({ success: false, message: 'No fee record found for this student. Please contact administrator.' });
    }

    const payAmount = parseFloat(amount || feeRecord.pending_amount || feeRecord.total_payable);
    if (isNaN(payAmount) || payAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    }

    let finalMethod = paymentMethod || payment_method || 'UPI / PhonePe Demo';
    if (!['UPI / PhonePe Demo', 'Card Demo', 'Cash'].includes(finalMethod)) {
      finalMethod = 'UPI / PhonePe Demo';
    }

    const ay = academicYear || feeRecord.academic_year || student.route_ay || '2026-27';

    await connection.beginTransaction();

    // 1. Generate unique Transaction ID
    const txnId = await generateTransactionId();

    // 2. Insert Payment record into MySQL
    const [payResult] = await connection.query(
      `INSERT INTO payments (
        student_id, fee_record_id, amount, payment_method, transaction_id, payment_status, payment_date
      ) VALUES (?, ?, ?, ?, ?, 'SUCCESSFUL', NOW())`,
      [student.id, recordId, payAmount, finalMethod, txnId]
    );
    const paymentId = payResult.insertId;

    // 3. Generate guaranteed unique 11-char Receipt Number (format ^F[0-9]{4}-[0-9]{5}$)
    const receiptNo = await generateReceiptNumber(ay);

    // 4. Convert amount into words
    const amountInWords = numberToWords(payAmount);

    // 5. Insert Receipt record into MySQL
    const [recResult] = await connection.query(
      `INSERT INTO receipts (
        payment_id, student_id, receipt_number, fee_particulars, amount, amount_in_words, payment_mode, receipt_date
      ) VALUES (?, ?, ?, 'Annual Transportation Fee', ?, ?, ?, NOW())`,
      [paymentId, student.id, receiptNo, payAmount, amountInWords, finalMethod]
    );

    // 6. Update Student Fee Record (paid_amount, pending_amount, payment_status)
    const newPaid = parseFloat(feeRecord.paid_amount) + payAmount;
    const totalDue = parseFloat(feeRecord.total_payable);
    const newPending = Math.max(0, totalDue - newPaid);
    const newStatus = newPending <= 0 ? 'PAID' : (newPaid > 0 ? 'PARTIALLY PAID' : 'UNPAID');

    await connection.query(
      `UPDATE student_fee_records SET
        paid_amount = ?, pending_amount = ?, payment_status = ?
       WHERE id = ?`,
      [newPaid, newPending, newStatus, recordId]
    );

    // 7. Update student's transportation status to approved if it was pending
    if (student.transportation_status === 'pending') {
      await connection.query(
        `UPDATE students SET transportation_status = 'approved' WHERE id = ?`,
        [student.id]
      );
    }

    // 8. Create Student Notification
    if (student.user_id) {
      await connection.query(
        `INSERT INTO notifications (user_id, target_role, title, message, category)
         VALUES (?, 'student', 'Payment Successful ✓', ?, 'success')`,
        [
          student.user_id,
          `Payment of ₹${payAmount.toLocaleString('en-IN')} received. Receipt No: ${receiptNo}. You can now apply for your digital bus pass!`
        ]
      );
    }

    // 9. Create Admin Notification
    await connection.query(
      `INSERT INTO notifications (user_id, target_role, title, message, category)
       VALUES (NULL, 'admin', 'Fee Payment Received', ?, 'success')`,
      [
        `Student ${student.name} (${student.roll_number}) paid ₹${payAmount.toLocaleString('en-IN')} via ${finalMethod}. Receipt: ${receiptNo}.`
      ]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Payment processed successfully! Official receipt generated.',
      receipt: {
        receiptNumber: receiptNo,
        transactionId: txnId,
        paymentId,
        studentId: student.id,
        studentName: student.name,
        rollNumber: student.roll_number,
        amount: payAmount,
        amountInWords,
        paymentMethod: finalMethod,
        date: new Date().toISOString(),
        paymentStatus: 'SUCCESSFUL'
      }
    });
  } catch (err) {
    await connection.rollback();
    console.error('processPayment error:', err);
    res.status(500).json({ success: false, message: 'Payment could not be completed. Please try again.', error: err.message });
  } finally {
    connection.release();
  }
};

/**
 * 2. Submit Cash Payment Request (Pending Admin Verification)
 */
exports.requestCashPayment = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { studentId, student_id, feeRecordId, fee_record_id, amount, notes } = req.body;

    let effectiveStudentId = studentId || student_id;
    if (req.user && req.user.role === 'student' && req.user.studentId) {
      effectiveStudentId = req.user.studentId;
    }

    if (!effectiveStudentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required.' });
    }

    const [students] = await connection.query('SELECT * FROM students WHERE id = ?', [effectiveStudentId]);
    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }
    const student = students[0];

    // Find Fee Record
    let recordId = feeRecordId || fee_record_id;
    let feeRecord = null;
    if (recordId) {
      const [recs] = await connection.query('SELECT * FROM student_fee_records WHERE id = ?', [recordId]);
      if (recs.length > 0) feeRecord = recs[0];
    }
    if (!feeRecord) {
      const [recs] = await connection.query(
        'SELECT * FROM student_fee_records WHERE student_id = ? ORDER BY id DESC LIMIT 1',
        [student.id]
      );
      if (recs.length > 0) {
        feeRecord = recs[0];
        recordId = feeRecord.id;
      }
    }
    if (!feeRecord) {
      return res.status(400).json({ success: false, message: 'No fee record found for student.' });
    }

    const payAmount = parseFloat(amount || feeRecord.pending_amount || feeRecord.total_payable);
    const txnId = await generateTransactionId();

    await connection.beginTransaction();

    const [payResult] = await connection.query(
      `INSERT INTO payments (
        student_id, fee_record_id, amount, payment_method, transaction_id, payment_status, payment_date, notes
      ) VALUES (?, ?, ?, 'Cash', ?, 'PENDING ADMIN VERIFICATION', NOW(), ?)`,
      [student.id, recordId, payAmount, txnId, notes || 'Cash submitted at campus transport counter']
    );

    // Notify Admin that cash verification is required
    await connection.query(
      `INSERT INTO notifications (user_id, target_role, title, message, category)
       VALUES (NULL, 'admin', 'Cash Verification Required', ?, 'warning')`,
      [
        `Student ${student.name} (${student.roll_number}) submitted cash payment request of ₹${payAmount.toLocaleString('en-IN')}. Verification required.`
      ]
    );

    // Notify Student
    if (student.user_id) {
      await connection.query(
        `INSERT INTO notifications (user_id, target_role, title, message, category)
         VALUES (?, 'student', 'Cash Payment Submitted', ?, 'info')`,
        [
          student.user_id,
          `Your cash payment of ₹${payAmount.toLocaleString('en-IN')} has been submitted and is PENDING ADMIN VERIFICATION.`
        ]
      );
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Cash payment request submitted. Awaiting Admin verification.',
      transactionId: txnId,
      status: 'PENDING ADMIN VERIFICATION'
    });
  } catch (err) {
    await connection.rollback();
    console.error('requestCashPayment error:', err);
    res.status(500).json({ success: false, message: 'Failed to submit cash payment request.', error: err.message });
  } finally {
    connection.release();
  }
};

/**
 * 3. Admin Cash Payment Approval
 */
exports.approveCashPayment = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params; // payment_id
    const adminUserId = req.user ? req.user.id : null;

    const [payments] = await connection.query('SELECT * FROM payments WHERE payment_id = ?', [id]);
    if (payments.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }
    const payment = payments[0];

    if (payment.payment_status === 'SUCCESSFUL') {
      return res.status(400).json({ success: false, message: 'Payment is already verified and successful.' });
    }

    const [students] = await connection.query('SELECT * FROM students WHERE id = ?', [payment.student_id]);
    const student = students[0];

    const [feeRecords] = await connection.query('SELECT * FROM student_fee_records WHERE id = ?', [payment.fee_record_id]);
    const feeRecord = feeRecords[0];

    const ay = feeRecord ? feeRecord.academic_year : '2026-27';

    await connection.beginTransaction();

    // 1. Mark payment as SUCCESSFUL
    await connection.query(
      `UPDATE payments SET
        payment_status = 'SUCCESSFUL',
        verified_by_admin_id = ?,
        verified_at = NOW()
       WHERE payment_id = ?`,
      [adminUserId, id]
    );

    // 2. Generate Receipt Number
    const receiptNo = await generateReceiptNumber(ay);
    const amountInWords = numberToWords(payment.amount);

    // 3. Create Receipt in MySQL
    await connection.query(
      `INSERT INTO receipts (
        payment_id, student_id, receipt_number, fee_particulars, amount, amount_in_words, payment_mode, receipt_date
      ) VALUES (?, ?, ?, 'Annual Transportation Fee (Cash)', ?, ?, 'Cash', NOW())`,
      [id, payment.student_id, receiptNo, payment.amount, amountInWords]
    );

    // 4. Update Student Fee Record
    if (feeRecord) {
      const newPaid = parseFloat(feeRecord.paid_amount) + parseFloat(payment.amount);
      const totalDue = parseFloat(feeRecord.total_payable);
      const newPending = Math.max(0, totalDue - newPaid);
      const newStatus = newPending <= 0 ? 'PAID' : (newPaid > 0 ? 'PARTIALLY PAID' : 'UNPAID');

      await connection.query(
        `UPDATE student_fee_records SET
          paid_amount = ?, pending_amount = ?, payment_status = ?
         WHERE id = ?`,
        [newPaid, newPending, newStatus, feeRecord.id]
      );
    }

    // 5. Update student transportation status if pending
    if (student && student.transportation_status === 'pending') {
      await connection.query(`UPDATE students SET transportation_status = 'approved' WHERE id = ?`, [student.id]);
    }

    // 6. Notify student
    if (student && student.user_id) {
      await connection.query(
        `INSERT INTO notifications (user_id, target_role, title, message, category)
         VALUES (?, 'student', 'Cash Payment Approved ✓', ?, 'success')`,
        [
          student.user_id,
          `Your cash payment of ₹${parseFloat(payment.amount).toLocaleString('en-IN')} has been verified by the Transport Office. Receipt ${receiptNo} issued.`
        ]
      );
    }

    await connection.commit();

    res.json({
      success: true,
      message: 'Cash payment verified and receipt generated successfully!',
      receiptNumber: receiptNo
    });
  } catch (err) {
    await connection.rollback();
    console.error('approveCashPayment error:', err);
    res.status(500).json({ success: false, message: 'Server error verifying cash payment.', error: err.message });
  } finally {
    connection.release();
  }
};

/**
 * 4. Admin Cash Payment Rejection
 */
exports.rejectCashPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminUserId = req.user ? req.user.id : null;

    const [payments] = await db.query('SELECT * FROM payments WHERE payment_id = ?', [id]);
    if (payments.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }
    const payment = payments[0];

    await db.query(
      `UPDATE payments SET
        payment_status = 'REJECTED',
        verified_by_admin_id = ?,
        verified_at = NOW(),
        notes = ?
       WHERE payment_id = ?`,
      [adminUserId, reason || 'Cash payment verification rejected by Transport Office', id]
    );

    // Notify student
    const [stu] = await db.query('SELECT user_id, name FROM students WHERE id = ?', [payment.student_id]);
    if (stu.length > 0 && stu[0].user_id) {
      await db.query(
        `INSERT INTO notifications (user_id, target_role, title, message, category)
         VALUES (?, 'student', 'Cash Payment Rejected', ?, 'danger')`,
        [
          stu[0].user_id,
          `Your cash payment of ₹${parseFloat(payment.amount).toLocaleString('en-IN')} was rejected. Reason: ${reason || 'Cash not received or invalid receipt'}.`
        ]
      );
    }

    res.json({ success: true, message: 'Cash payment rejected.' });
  } catch (err) {
    console.error('rejectCashPayment error:', err);
    res.status(500).json({ success: false, message: 'Server error rejecting cash payment.', error: err.message });
  }
};

/**
 * 5. Admin Payments Ledger (Search & Filter)
 */
exports.getAllPayments = async (req, res) => {
  try {
    const { search, status, paymentMethod, studentId } = req.query;

    let query = `
      SELECT p.payment_id, p.student_id, p.fee_record_id, p.amount,
             p.payment_method, p.transaction_id, p.payment_status, p.payment_date, p.notes,
             s.name AS student_name, s.roll_number, s.course, s.phone,
             r.receipt_number
      FROM payments p
      JOIN students s ON p.student_id = s.id
      LEFT JOIN receipts r ON p.payment_id = r.payment_id
      WHERE 1=1
    `;
    const params = [];

    if (studentId) {
      query += ` AND p.student_id = ?`;
      params.push(studentId);
    }

    if (status) {
      query += ` AND LOWER(p.payment_status) = LOWER(?)`;
      params.push(status);
    }

    if (paymentMethod) {
      query += ` AND LOWER(p.payment_method) = LOWER(?)`;
      params.push(paymentMethod);
    }

    if (search) {
      const q = `%${search.trim().toLowerCase()}%`;
      query += ` AND (LOWER(s.name) LIKE ? OR LOWER(s.roll_number) LIKE ? OR LOWER(p.transaction_id) LIKE ? OR (r.receipt_number IS NOT NULL AND LOWER(r.receipt_number) LIKE ?))`;
      params.push(q, q, q, q);
    }

    query += ` ORDER BY p.payment_date DESC`;

    const [rows] = await db.query(query, params);

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('getAllPayments error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving payments.', error: err.message });
  }
};

/**
 * 6. Student Payment History (shows only that student's records)
 */
exports.getStudentPayments = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Verify student identity
    const [students] = await db.query(
      'SELECT id FROM students WHERE id = ? OR user_id = ? OR UPPER(roll_number) = UPPER(?)',
      [studentId, studentId, studentId]
    );

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    const realStudentId = students[0].id;

    // Enforce that student can only view their own payment history
    if (req.user && req.user.role === 'student' && req.user.studentId && req.user.studentId != realStudentId) {
      return res.status(403).json({ success: false, message: 'Access denied: You can only view your own payment records.' });
    }

    const [rows] = await db.query(`
      SELECT p.payment_id, p.amount, p.payment_method, p.transaction_id, p.payment_status, p.payment_date,
             r.receipt_number, r.id AS receipt_id, r.amount_in_words
      FROM payments p
      LEFT JOIN receipts r ON p.payment_id = r.payment_id
      WHERE p.student_id = ?
      ORDER BY p.payment_date DESC
    `, [realStudentId]);

    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('getStudentPayments error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving student payments.', error: err.message });
  }
};

/**
 * 7. Receipt Retrieval directly from MySQL
 * Reflects latest student updates (Course, Admission No, Parent Name, etc.) directly from MySQL!
 */
exports.getReceiptById = async (req, res) => {
  try {
    const { id } = req.params; // receipt_number, receipt id, or payment_id

    const [rows] = await db.query(`
      SELECT r.id AS receipt_id, r.receipt_number, r.fee_particulars, r.amount, r.amount_in_words,
             r.payment_mode, r.receipt_date,
             p.payment_id, p.transaction_id, p.payment_status, p.payment_date,
             s.id AS student_id, s.name AS student_name, s.roll_number, s.course,
             s.admission_number, s.parent_name, s.phone AS student_phone, s.email AS student_email,
             rt.route_number, rt.route_name,
             b.bus_number,
             l.name AS pickup_location_name
      FROM receipts r
      JOIN payments p ON r.payment_id = p.payment_id
      JOIN students s ON r.student_id = s.id
      LEFT JOIN routes rt ON s.assigned_route_id = rt.id
      LEFT JOIN buses b ON s.assigned_bus_id = b.id
      LEFT JOIN locations l ON s.pickup_location_id = l.id
      WHERE r.receipt_number = ? OR r.id = ? OR p.payment_id = ? OR p.transaction_id = ?
      LIMIT 1
    `, [id, id, id, id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Receipt not found.' });
    }

    const row = rows[0];

    // Format receipt data adhering strictly to Requirement 22 & 23
    const receiptData = {
      college: {
        name: 'College of Engineering & Technology',
        department: 'Transportation Logistics & Commuter Services',
        address: 'Campus Main Gate, Transit Terminal, College Road',
        phone: '+91 98450 11223',
        email: 'transport@college.edu'
      },
      receipt: {
        receiptNumber: row.receipt_number,
        date: row.receipt_date || row.payment_date,
        formattedDate: new Date(row.receipt_date || row.payment_date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        }),
        formattedTime: new Date(row.receipt_date || row.payment_date).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit'
        })
      },
      student: {
        studentId: row.student_id,
        name: row.student_name,
        rollNumber: row.roll_number,
        course: row.course || 'N/A',
        admissionNumber: row.admission_number || 'N/A',
        parentName: row.parent_name || 'N/A',
        phone: row.student_phone,
        email: row.student_email,
        assignedRoute: row.route_number ? `${row.route_number} - ${row.route_name}` : 'N/A',
        assignedBus: row.bus_number || 'N/A',
        pickupLocation: row.pickup_location_name || 'N/A'
      },
      fee: {
        particulars: row.fee_particulars || 'Annual Transportation Fee',
        amount: parseFloat(row.amount),
        formattedAmount: `₹${parseFloat(row.amount).toLocaleString('en-IN')}`,
        amountInWords: row.amount_in_words,
        paymentMode: row.payment_mode
      },
      transaction: {
        transactionId: row.transaction_id,
        paymentStatus: row.payment_status
      }
    };

    res.json({ success: true, data: receiptData });
  } catch (err) {
    console.error('getReceiptById error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving receipt.', error: err.message });
  }
};
