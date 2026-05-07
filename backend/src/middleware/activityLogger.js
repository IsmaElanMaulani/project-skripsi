const { pool } = require('../config/database');

// Log user activity
async function logActivity(userId, username, action, description, req) {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    await pool.query(
      `INSERT INTO activity_logs (user_id, username, action, description, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, username, action, description, ipAddress, userAgent]
    );
  } catch (err) {
    console.error('Activity log error:', err);
    // Don't throw error, just log it
  }
}

// Middleware to automatically log certain actions
function activityLoggerMiddleware(action, getDescription) {
  return async (req, res, next) => {
    // Store original send function
    const originalSend = res.send;

    // Override send function
    res.send = function (data) {
      // Only log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (req.user) {
          const description = typeof getDescription === 'function' 
            ? getDescription(req, res) 
            : getDescription || action;
          
          logActivity(
            req.user.id,
            req.user.username,
            action,
            description,
            req
          ).catch(err => console.error('Log activity error:', err));
        }
      }

      // Call original send
      originalSend.call(this, data);
    };

    next();
  };
}

module.exports = { logActivity, activityLoggerMiddleware };
