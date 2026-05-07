require('dotenv').config();
const { sendDailyReport } = require('./src/services/cronService');

async function testDailyReport() {
  console.log('🧪 Testing Daily Report Function...\n');
  
  try {
    console.log('📧 Sending morning report...');
    await sendDailyReport('morning');
    
    console.log('\n✅ Test completed! Check your email: ismaelanmaulani068@gmail.com');
    console.log('📬 Subject: 📊 Laporan Pagi SecMonitor - [Today\'s Date]');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testDailyReport();
