const pool = require('../config/db');

async function migrate() {
  console.log('Starting MySQL migration for SCTMS enhancements...');

  // 1. Add semester to students if missing
  const [colsStu] = await pool.query("SHOW COLUMNS FROM students LIKE 'semester'");
  if (colsStu.length === 0) {
    await pool.query("ALTER TABLE students ADD COLUMN semester VARCHAR(20) DEFAULT '1' AFTER year_of_study");
    console.log('✅ Added semester column to students table');
  } else {
    console.log('ℹ️ semester column already present in students table');
  }

  // 2. Expand roll_number to VARCHAR(50) in students and bus_pass_applications
  await pool.query("ALTER TABLE students MODIFY COLUMN roll_number VARCHAR(50) NOT NULL");
  console.log('✅ Updated students.roll_number to VARCHAR(50)');

  const [colsPassRoll] = await pool.query("SHOW COLUMNS FROM bus_pass_applications LIKE 'roll_number'");
  if (colsPassRoll.length > 0) {
    await pool.query("ALTER TABLE bus_pass_applications MODIFY COLUMN roll_number VARCHAR(50) NOT NULL");
    console.log('✅ Updated bus_pass_applications.roll_number to VARCHAR(50)');
  }

  // 3. Add driver_id_code to drivers table if missing
  const [colsDrv] = await pool.query("SHOW COLUMNS FROM drivers LIKE 'driver_id_code'");
  if (colsDrv.length === 0) {
    await pool.query("ALTER TABLE drivers ADD COLUMN driver_id_code VARCHAR(50) NULL UNIQUE AFTER user_id");
    console.log('✅ Added driver_id_code to drivers table');
  } else {
    console.log('ℹ️ driver_id_code already present in drivers table');
  }

  // 4. Add reason column to bus_pass_applications if missing
  const [colsPassApp] = await pool.query("SHOW COLUMNS FROM bus_pass_applications LIKE 'reason'");
  if (colsPassApp.length === 0) {
    await pool.query("ALTER TABLE bus_pass_applications ADD COLUMN reason TEXT NULL AFTER status");
    console.log('✅ Added reason column to bus_pass_applications table');
  } else {
    console.log('ℹ️ reason column already present in bus_pass_applications table');
  }

  // 5. Expand payments.payment_method to VARCHAR(50)
  await pool.query("ALTER TABLE payments MODIFY COLUMN payment_method VARCHAR(50) NOT NULL");
  console.log('✅ Updated payments.payment_method to VARCHAR(50)');

  // 6. Update student_fee_records.payment_status to VARCHAR(30)
  await pool.query("ALTER TABLE student_fee_records MODIFY COLUMN payment_status VARCHAR(30) DEFAULT 'PENDING'");
  console.log('✅ Updated student_fee_records.payment_status to VARCHAR(30)');

  // 7. Update any 'UNPAID' to 'PENDING' if desired or keep both supported
  await pool.query("UPDATE student_fee_records SET payment_status = 'PENDING' WHERE payment_status = 'UNPAID'");
  console.log('✅ Synchronized UNPAID status to PENDING');

  console.log('✨ All schema migrations successfully completed!');
  pool.end();
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  pool.end();
  process.exit(1);
});
