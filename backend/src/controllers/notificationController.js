const { pool } = require('../config/database');

async function getNotifications(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50'
    );
    const [[{ unread }]] = await pool.query(
      'SELECT COUNT(*) as unread FROM notifications WHERE is_read = 0'
    );
    res.json({ success: true, notifications: rows, unread });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function markRead(req, res) {
  const { id } = req.params;
  try {
    if (id === 'all') {
      await pool.query('UPDATE notifications SET is_read = 1');
    } else {
      await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    }
    res.json({ success: true, message: 'Notifikasi ditandai sudah dibaca' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { getNotifications, markRead };
