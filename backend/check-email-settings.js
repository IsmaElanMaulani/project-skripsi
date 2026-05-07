require('dotenv').config();
const { pool } = require('./src/config/database');

async function checkSettings() {
  try {
    const [rows] = await pool.query('SELECT * FROM settings WHERE key_name LIKE "email%"');
    console.log('\n📧 Email Settings in Database:\n');
    rows.forEach(row => {
      const value = row.key_name.includes('password') ? '***hidden***' : row.value;
      console.log(`${row.key_name}: ${value}`);
    });
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSettings();
