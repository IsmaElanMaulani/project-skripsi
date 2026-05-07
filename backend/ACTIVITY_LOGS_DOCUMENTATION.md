# Activity Logs Documentation

## Overview
Activity Logs adalah fitur untuk mencatat dan memonitor semua aktivitas user di sistem SecMonitor. Setiap aksi penting yang dilakukan user akan tercatat secara otomatis.

## Features

### 1. Automatic Logging
Sistem secara otomatis mencatat aktivitas berikut:
- ✅ **Login** - User berhasil login
- ❌ **Login Failed** - Percobaan login gagal
- 🚪 **Logout** - User logout dari sistem
- ➕ **Create** - Membuat data baru (user, domain, dll)
- ✏️ **Update** - Mengupdate data
- 🗑️ **Delete** - Menghapus data
- 🔍 **Scan** - Melakukan scan (malware, domain, dll)
- 📊 **View** - Melihat data sensitif

### 2. Information Captured
Setiap log mencatat:
- **User ID & Username** - Siapa yang melakukan aksi
- **Action** - Jenis aksi yang dilakukan
- **Description** - Detail lengkap aksi
- **IP Address** - Alamat IP user
- **User Agent** - Browser/device yang digunakan
- **Timestamp** - Waktu aksi dilakukan

### 3. Filtering & Search
- 🔍 Search by username, action, atau description
- 📅 Filter by date range
- 👤 Filter by specific user
- 🎯 Filter by action type

### 4. Statistics Dashboard
- Total activities
- Activities in last 24 hours
- Top actions performed
- Most active users
- Activity by hour chart

### 5. Export & Cleanup
- 📥 **Export to CSV** - Download logs dalam format CSV
- 🗑️ **Cleanup Old Logs** - Hapus log lebih dari 90 hari
- 📊 **Pagination** - Browse logs dengan mudah

## Database Schema

```sql
CREATE TABLE activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  username VARCHAR(100),
  action VARCHAR(255) NOT NULL,
  description TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);
```

## API Endpoints

### Get Activity Logs
```
GET /api/activity-logs
Query Parameters:
  - page: number (default: 1)
  - limit: number (default: 50)
  - search: string
  - action: string
  - user_id: number
  - start_date: datetime
  - end_date: datetime
```

### Get Statistics
```
GET /api/activity-logs/stats
```

### Export Logs
```
GET /api/activity-logs/export
Query Parameters:
  - start_date: datetime
  - end_date: datetime
```

### Cleanup Old Logs
```
POST /api/activity-logs/cleanup
Body:
  - days: number (default: 90)
```

## Usage in Code

### Manual Logging
```javascript
const { logActivity } = require('../middleware/activityLogger');

// Log an activity
await logActivity(
  userId,
  username,
  'ACTION_NAME',
  'Description of the action',
  req
);
```

### Automatic Logging with Middleware
```javascript
const { activityLoggerMiddleware } = require('../middleware/activityLogger');

// Add to route
router.post('/some-action', 
  authMiddleware,
  activityLoggerMiddleware('ACTION_NAME', 'Description'),
  controller.someAction
);
```

## Action Types

### Authentication
- `LOGIN` - Successful login
- `LOGIN_FAILED` - Failed login attempt
- `LOGOUT` - User logout

### User Management
- `USER_CREATE` - Create new user
- `USER_UPDATE` - Update user data
- `USER_DELETE` - Delete user

### Domain Monitoring
- `DOMAIN_ADD` - Add new domain
- `DOMAIN_SCAN` - Scan domain
- `DOMAIN_DELETE` - Delete domain

### Security Operations
- `MALWARE_SCAN` - Scan for malware
- `IP_CHECK` - Check IP address
- `CVE_FETCH` - Fetch CVE data

### Settings
- `SETTINGS_UPDATE` - Update system settings

## Security Considerations

1. **Data Retention**: Logs older than 90 days should be cleaned up regularly
2. **Sensitive Data**: Never log passwords or API keys
3. **Access Control**: Only admin users can view activity logs
4. **IP Privacy**: Consider GDPR compliance for IP address storage

## Best Practices

1. ✅ Log all authentication attempts (success and failure)
2. ✅ Log all data modifications (create, update, delete)
3. ✅ Log access to sensitive data
4. ✅ Include meaningful descriptions
5. ❌ Don't log sensitive information (passwords, tokens)
6. ❌ Don't log too frequently (avoid spam)
7. ✅ Regular cleanup of old logs
8. ✅ Monitor for suspicious patterns

## Monitoring & Alerts

Activity logs dapat digunakan untuk:
- 🔍 Audit trail untuk compliance
- 🚨 Detect suspicious activities
- 📊 User behavior analysis
- 🐛 Debugging dan troubleshooting
- 📈 Usage statistics

## Example Queries

### Find failed login attempts
```sql
SELECT * FROM activity_logs 
WHERE action = 'LOGIN_FAILED' 
ORDER BY created_at DESC;
```

### Find user activities in last 24 hours
```sql
SELECT * FROM activity_logs 
WHERE user_id = ? 
AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR);
```

### Count activities by action type
```sql
SELECT action, COUNT(*) as count 
FROM activity_logs 
GROUP BY action 
ORDER BY count DESC;
```

## Future Enhancements

- [ ] Real-time activity monitoring
- [ ] Anomaly detection
- [ ] Activity heatmap visualization
- [ ] Email alerts for suspicious activities
- [ ] Integration with SIEM systems
- [ ] Advanced analytics and reporting
