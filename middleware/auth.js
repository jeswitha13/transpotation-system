const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secure_college_transportation_key_2026';

/**
 * Authentication middleware that verifies token or header identity directly from MySQL
 */
async function authenticate(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'];
    }

    let userId = null;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.id || decoded.userId;
      } catch (err) {
        // Fallback check if token is format demo-token-<id>-<ts>
        if (token.startsWith('demo-token-')) {
          const parts = token.split('-');
          userId = parts[2];
        }
      }
    }

    // Fallback to x-user-id header if token wasn't provided (for flexible frontend integration)
    if (!userId && req.headers['x-user-id']) {
      userId = req.headers['x-user-id'];
    }

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required. Please sign in.' });
    }

    // Fetch user from MySQL
    const [users] = await db.query(
      'SELECT id, username, email, role, full_name, phone, avatar, status FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'User session invalid or user deleted.' });
    }

    const user = users[0];

    // If student, attach student DB details
    if (user.role === 'student') {
      const [stu] = await db.query('SELECT * FROM students WHERE user_id = ?', [user.id]);
      if (stu.length > 0) {
        user.student = stu[0];
        user.studentId = stu[0].id;
        user.rollNumber = stu[0].roll_number;
      }
    } else if (user.role === 'driver') {
      const [drv] = await db.query('SELECT * FROM drivers WHERE user_id = ?', [user.id]);
      if (drv.length > 0) {
        user.driver = drv[0];
        user.driverId = drv[0].id;
        user.assignedBusId = drv[0].assigned_bus_id;
      }
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ success: false, message: 'Internal server error during authentication.' });
  }
}

/**
 * Role-based authorization middleware
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access forbidden: Insufficient permissions.' });
    }
    next();
  };
}

module.exports = {
  authenticate,
  requireRole,
  JWT_SECRET
};
