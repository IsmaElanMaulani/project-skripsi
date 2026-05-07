const { pool } = require('../config/database');

// Get activity logs with pagination and filters
async function getActivityLogs(req, res) {
  try {
    const { 
      page = 1, 
      limit = 50, 
      user_id, 
      action, 
      start_date, 
      end_date,
      search 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Build query
    let whereConditions = [];
    let queryParams = [];

    if (user_id) {
      whereConditions.push('user_id = ?');
      queryParams.push(user_id);
    }

    if (action) {
      whereConditions.push('action LIKE ?');
      queryParams.push(`%${action}%`);
    }

    if (start_date) {
      whereConditions.push('created_at >= ?');
      queryParams.push(start_date);
    }

    if (end_date) {
      whereConditions.push('created_at <= ?');
      queryParams.push(end_date);
    }

    if (search) {
      whereConditions.push('(username LIKE ? OR action LIKE ? OR description LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ') 
      : '';

    // Get total count
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) as total FROM activity_logs ${whereClause}`,
      queryParams
    );

    // Get logs
    const [logs] = await pool.query(
      `SELECT * FROM activity_logs ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(limit), offset]
    );

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('getActivityLogs error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Get activity statistics
async function getActivityStats(req, res) {
  try {
    // Total activities
    const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM activity_logs');

    // Activities by action type
    const [byAction] = await pool.query(`
      SELECT action, COUNT(*) as count 
      FROM activity_logs 
      GROUP BY action 
      ORDER BY count DESC 
      LIMIT 10
    `);

    // Activities by user
    const [byUser] = await pool.query(`
      SELECT username, COUNT(*) as count 
      FROM activity_logs 
      WHERE username IS NOT NULL
      GROUP BY username 
      ORDER BY count DESC 
      LIMIT 10
    `);

    // Recent activities (last 24 hours)
    const [[{ recent }]] = await pool.query(`
      SELECT COUNT(*) as recent 
      FROM activity_logs 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);

    // Activities by hour (last 24 hours)
    const [byHour] = await pool.query(`
      SELECT 
        HOUR(created_at) as hour,
        COUNT(*) as count
      FROM activity_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY HOUR(created_at)
      ORDER BY hour
    `);

    res.json({
      success: true,
      stats: {
        total,
        recent,
        byAction,
        byUser,
        byHour
      }
    });
  } catch (err) {
    console.error('getActivityStats error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Delete old logs (cleanup)
async function deleteOldLogs(req, res) {
  try {
    const { days = 90 } = req.body;

    const [result] = await pool.query(
      `DELETE FROM activity_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [parseInt(days)]
    );

    res.json({
      success: true,
      message: `Berhasil menghapus ${result.affectedRows} log lama`,
      deleted: result.affectedRows
    });
  } catch (err) {
    console.error('deleteOldLogs error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// Export logs to CSV
async function exportLogs(req, res) {
  try {
    const { start_date, end_date } = req.query;
    
    let whereClause = '';
    let queryParams = [];

    if (start_date && end_date) {
      whereClause = 'WHERE created_at BETWEEN ? AND ?';
      queryParams = [start_date, end_date];
    }

    const [logs] = await pool.query(
      `SELECT * FROM activity_logs ${whereClause} ORDER BY created_at DESC LIMIT 10000`,
      queryParams
    );

    // Generate CSV
    let csv = 'ID,User ID,Username,Action,Description,IP Address,Created At\n';
    logs.forEach(log => {
      csv += `${log.id},"${log.user_id || ''}","${log.username || ''}","${log.action}","${(log.description || '').replace(/"/g, '""')}","${log.ip_address}","${log.created_at}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=activity-logs-${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('exportLogs error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = {
  getActivityLogs,
  getActivityStats,
  deleteOldLogs,
  exportLogs
};
