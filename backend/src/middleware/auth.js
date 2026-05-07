const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token tidak ditemukan' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Token tidak valid atau kadaluarsa' });
  }
}

function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Akses ditolak: hanya admin' });
  }
  next();
}

// Middleware untuk admin dan operator
function adminOrOperator(req, res, next) {
  if (!['admin', 'operator'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Akses ditolak: hanya admin atau operator' });
  }
  next();
}

// Middleware untuk admin, operator, dan analyst
function staffOnly(req, res, next) {
  if (!['admin', 'operator', 'analyst'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Akses ditolak: hanya staff' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly, adminOrOperator, staffOnly };
