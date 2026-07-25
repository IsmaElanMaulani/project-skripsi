const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const users = [
  {
    username: 'viewer1',
    email: 'viewer@security.local',
    password: 'viewer123',
    role: 'viewer'
  },
  {
    username: 'analyst',
    email: 'analyst@security.local',
    password: 'analyst123',
    role: 'analyst'
  },
  {
    username: 'operator',
    email: 'operator@security.local',
    password: 'operator123',
    role: 'operator'
  }
];

async function createUsers() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'security_monitoring'
  });

  console.log('✅ Connected to database');

  try {
    for (const user of users) {
      // Check if user already exists
      const [existing] = await connection.execute(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [user.username, user.email]
      );

      if (existing.length > 0) {
        console.log(`⚠️  User ${user.username} already exists, skipping...`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(user.password, 10);

      // Insert user
      await connection.execute(
        'INSERT INTO users (username, email, password, role, is_active) VALUES (?, ?, ?, ?, ?)',
        [user.username, user.email, hashedPassword, user.role, 1]
      );

      console.log(`✅ Created user: ${user.username} (${user.role})`);
    }

    console.log('\n📋 Summary of created users:');
    console.log('┌─────────────┬──────────────────────────┬──────────┬──────────┐');
    console.log('│ Username    │ Email                    │ Password │ Role     │');
    console.log('├─────────────┼──────────────────────────┼──────────┼──────────┤');
    users.forEach(u => {
      console.log(`│ ${u.username.padEnd(11)} │ ${u.email.padEnd(24)} │ ${u.password.padEnd(8)} │ ${u.role.padEnd(8)} │`);
    });
    console.log('└─────────────┴──────────────────────────┴──────────┴──────────┘');
    console.log('\n✅ All users created successfully!');

  } catch (error) {
    console.error('❌ Error creating users:', error.message);
  } finally {
    await connection.end();
  }
}

createUsers();
