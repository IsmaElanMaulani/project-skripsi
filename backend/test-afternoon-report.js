require('dotenv').config();
const { sendDailyReport } = require('./src/services/cronService');

async function testAfternoonReport() {
  console.log('🧪 Testing Afternoon Report Function...\n');
  
  try {
    console.log('📧 Sending afternoon report...');
    await sendDailyReport('afternoon');
    
    console.log('\n✅ Test completed! Check your email: ismaelanmaulani068@gmail.com');
    console.log('📬 Subject: 📊 Laporan Sore SecMonitor - [Today\'s Date]');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testAfternoonReport();
