const db = require('../config/db');

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : (req.headers['x-user-id'] || req.query.userId);
    const role = req.user ? req.user.role : (req.query.role || 'all');

    let query = `
      SELECT * FROM notifications
      WHERE 1=1
    `;
    const params = [];

    if (userId) {
      query += ` AND (user_id = ? OR target_role = ? OR target_role = 'all')`;
      params.push(userId, role);
    } else if (role) {
      query += ` AND (target_role = ? OR target_role = 'all')`;
      params.push(role);
    }

    query += ` ORDER BY id DESC LIMIT 50`;

    const [rows] = await db.query(query, params);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    console.error('getNotifications error:', err);
    res.status(500).json({ success: false, message: 'Server error retrieving notifications.', error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [id]);
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    console.error('markAsRead error:', err);
    res.status(500).json({ success: false, message: 'Server error updating notification.', error: err.message });
  }
};
