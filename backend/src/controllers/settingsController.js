const { pool } = require('../config/database');

async function getSettings(req, res) {
  try {
    const [rows] = await pool.query('SELECT key_name, value, description FROM settings ORDER BY key_name');
    const settings = {};
    rows.forEach((r) => (settings[r.key_name] = { value: r.value, description: r.description }));
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function updateSettings(req, res) {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ success: false, message: 'Data settings tidak valid' });
  }

  try {
    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        `UPDATE settings SET value = ? WHERE key_name = ?`,
        [String(value), key]
      );
    }
    res.json({ success: true, message: 'Settings berhasil disimpan' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { getSettings, updateSettings };
