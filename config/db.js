const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'college_transportation',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true
});

// Test connection on launch
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log(`✅ [MySQL Pool] Successfully connected to database: ${process.env.DB_NAME || 'college_transportation'}`);
    conn.release();
  } catch (err) {
    console.error(`❌ [MySQL Pool] Database connection error: ${err.message}`);
    console.error(`👉 Verify MySQL credentials in .env file and ensure MySQL service is running.`);
  }
})();

module.exports = pool;
