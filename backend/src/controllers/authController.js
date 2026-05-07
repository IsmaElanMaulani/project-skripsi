const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { logActivity } = require('../middleware/activityLogger');

async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password wajib diisi' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1',
      [username, username]
    );

    if (rows.length === 0) {
      // Log failed login attempt
      await logActivity(null, username, 'LOGIN_FAILED', `Failed login attempt for username: ${username}`, req);
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      // Log failed login attempt
      await logActivity(user.id, user.username, 'LOGIN_FAILED', `Failed login attempt - incorrect password`, req);
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Log successful login
    await logActivity(user.id, user.username, 'LOGIN', `User logged in successfully`, req);

    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function logout(req, res) {
  // Log logout
  if (req.user) {
    await logActivity(req.user.id, req.user.username, 'LOGOUT', 'User logged out', req);
  }
  res.json({ success: true, message: 'Logout berhasil' });
}

async function me(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, role, last_login, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { login, logout, me };
