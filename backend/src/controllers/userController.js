const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

async function getUsers(req, res) {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, users: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function createUser(req, res) {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'Username, email, dan password wajib diisi' });
  }

  // Validasi role
  const validRoles = ['admin', 'operator', 'analyst', 'viewer'];
  const userRole = role || 'viewer';
  if (!validRoles.includes(userRole)) {
    return res.status(400).json({ success: false, message: 'Role tidak valid. Pilih: admin, operator, analyst, atau viewer' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hash, userRole]
    );
    res.status(201).json({ success: true, message: 'User berhasil dibuat', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Username atau email sudah digunakan' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function updateUser(req, res) {
  const { id } = req.params;
  const { username, email, password, role, is_active } = req.body;

  try {
    const updates = [];
    const params = [];

    if (username) { updates.push('username = ?'); params.push(username); }
    if (email) { updates.push('email = ?'); params.push(email); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      params.push(hash);
    }
    if (role) { updates.push('role = ?'); params.push(role); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Tidak ada data yang diupdate' });
    }

    params.push(id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'User berhasil diupdate' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Username atau email sudah digunakan' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function deleteUser(req, res) {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'Tidak bisa menghapus akun sendiri' });
  }

  try {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { getUsers, createUser, updateUser, deleteUser };
