const db = require('../config/db');

/**
 * Validates student roll number format: exactly 10 alphanumeric characters
 * Example: 23A45B6789
 */
function isValidRollNumber(rollNumber) {
  if (!rollNumber || typeof rollNumber !== 'string') return false;
  return /^[A-Za-z0-9]{3,20}$/.test(rollNumber.trim());
}

/**
 * Validates receipt number format: exactly 11 characters
 * Pattern: ^F[0-9]{4}-[0-9]{5}$
 * Example: F2526-16444
 */
function isValidReceiptNumber(receiptNumber) {
  if (!receiptNumber || typeof receiptNumber !== 'string') return false;
  return /^F[0-9]{4}-[0-9]{5}$/.test(receiptNumber.trim());
}

/**
 * Extracts 4-digit academic year code, e.g. "2026-27" -> "2627", "2025-26" -> "2526"
 */
function getAcademicYearCode(ay) {
  if (!ay) {
    const yr = new Date().getFullYear();
    const nextYr = (yr + 1) % 100;
    return `${yr % 100}${nextYr < 10 ? '0' + nextYr : nextYr}`;
  }
  const clean = ay.replace(/[^0-9]/g, '');
  if (clean.length === 4) return clean; // e.g. "2526"
  if (clean.length === 6) { // e.g. "202627"
    return clean.slice(2);
  }
  return '2627';
}

/**
 * Automatically generates a guaranteed UNIQUE 11-char receipt number
 * Format: F + 4-digit AY + '-' + 5-digit sequence (e.g. F2526-16444)
 */
async function generateReceiptNumber(academicYear) {
  const ayCode = getAcademicYearCode(academicYear);
  const prefix = `F${ayCode}-`;

  // Fetch highest sequence number for this prefix from receipts
  const [rows] = await db.query(
    'SELECT receipt_number FROM receipts WHERE receipt_number LIKE ? ORDER BY id DESC LIMIT 1',
    [`${prefix}%`]
  );

  let nextSeq = 10001;
  if (rows.length > 0) {
    const lastNum = rows[0].receipt_number;
    const parts = lastNum.split('-');
    if (parts.length === 2 && !isNaN(parts[1])) {
      nextSeq = parseInt(parts[1], 10) + 1;
    }
  }

  // Ensure 5 digits
  let candidate = `${prefix}${String(nextSeq).padStart(5, '0')}`;

  // Double check uniqueness loop
  let isUnique = false;
  while (!isUnique) {
    const [chk] = await db.query('SELECT id FROM receipts WHERE receipt_number = ?', [candidate]);
    if (chk.length === 0) {
      isUnique = true;
    } else {
      nextSeq++;
      candidate = `${prefix}${String(nextSeq).padStart(5, '0')}`;
    }
  }

  return candidate;
}

/**
 * Automatically generates a guaranteed UNIQUE transaction ID
 * Example: TXN20261002123456
 */
async function generateTransactionId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');

  let rand = Math.floor(1000 + Math.random() * 9000);
  let txnId = `TXN${y}${m}${d}${h}${min}${s}${rand}`;

  let isUnique = false;
  while (!isUnique) {
    const [chk] = await db.query('SELECT payment_id FROM payments WHERE transaction_id = ?', [txnId]);
    if (chk.length === 0) {
      isUnique = true;
    } else {
      rand = Math.floor(1000 + Math.random() * 9000);
      txnId = `TXN${y}${m}${d}${h}${min}${s}${rand}`;
    }
  }

  return txnId;
}

module.exports = {
  isValidRollNumber,
  isValidReceiptNumber,
  generateReceiptNumber,
  generateTransactionId
};
