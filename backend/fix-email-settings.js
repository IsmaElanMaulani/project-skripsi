require('dotenv').config();
const { pool } = require('./src/config/database');

async function fixSettings() {
  try {
    console.log('🔧 Fixing email settings...\n');
    
    // Fix SMTP host
    await pool.query(
      'UPDATE settings SET value = ? WHERE key_name = ?',
      ['smtp.gmail.com', 'email_smtp_host']
    );
    console.log('✅ Updated email_smtp_host to: smtp.gmail.com');
    
    // Fix SMTP user
    await pool.query(
      'UPDATE settings SET value = ? WHERE key_name = ?',
      ['ismaelanmaulani068@gmail.com', 'email_smtp_user']
    );
    console.log('✅ Updated email_smtp_user to: ismaelanmaulani068@gmail.com');
    
    console.log('\n✅ Email settings fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixSettings();
