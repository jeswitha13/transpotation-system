const db = require('../config/db');

exports.getDashboardSummary = async (req, res) => {
  try {
    const [[stuCount]] = await db.query('SELECT COUNT(*) AS total FROM students');
    const [[passCount]] = await db.query('SELECT COUNT(*) AS total FROM bus_passes WHERE status = "ACTIVE"');
    const [[busCount]] = await db.query('SELECT COUNT(*) AS total FROM buses');
    const [[activeBusCount]] = await db.query('SELECT COUNT(*) AS total FROM buses WHERE status = "active"');
    const [[drvCount]] = await db.query('SELECT COUNT(*) AS total FROM drivers');
    const [[rtCount]] = await db.query('SELECT COUNT(*) AS total FROM routes WHERE status = "active"');
    const [[revCount]] = await db.query('SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE payment_status = "SUCCESSFUL"');
    const [[cancelCount]] = await db.query('SELECT COUNT(*) AS total FROM cancellation_requests WHERE status = "PENDING"');
    const [[pendingPassCount]] = await db.query('SELECT COUNT(*) AS total FROM bus_pass_applications WHERE status = "PENDING"');

    // Recent activity list
    const [activities] = await db.query(
      'SELECT id, title, message, category, created_at FROM notifications ORDER BY id DESC LIMIT 6'
    );

    // Bus capacity chart
    const [busUtilization] = await db.query(`
      SELECT b.bus_number, b.capacity,
             (SELECT COUNT(*) FROM students s WHERE s.assigned_bus_id = b.id) AS occupied
      FROM buses b
      LIMIT 6
    `);

    // Department distribution
    const [deptDistribution] = await db.query(`
      SELECT course, COUNT(*) AS count
      FROM students
      GROUP BY course
      LIMIT 5
    `);

    res.json({
      success: true,
      stats: {
        totalStudents: stuCount.total,
        activeStudents: passCount.total,
        totalBuses: busCount.total,
        activeBuses: activeBusCount.total,
        totalDrivers: drvCount.total,
        totalRoutes: rtCount.total,
        revenue: revCount.total,
        pendingRequests: cancelCount.total,
        pendingPasses: pendingPassCount.total
      },
      charts: {
        busUtilization,
        deptDistribution
      },
      recentActivity: activities
    });
  } catch (err) {
    console.error('getDashboardSummary error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving dashboard analytics.', error: err.message });
  }
};
