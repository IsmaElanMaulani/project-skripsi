require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function resetAdmin() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  const hash = await bcrypt.hash('admin123', 10);

  // Update jika sudah ada, insert jika belum
  await conn.query(`
    INSERT INTO users (username, email, password, role, is_active)
    VALUES ('admin', 'admin@security.local', ?, 'admin', 1)
    ON DUPLICATE KEY UPDATE password = ?, is_active = 1
  `, [hash, hash]);

  console.log('✅ Password admin berhasil direset ke: admin123');
  await conn.end();
}

resetAdmin().catch(console.error);
