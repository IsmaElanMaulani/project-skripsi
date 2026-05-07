require('dotenv').config();
const { sendNotification } = require('./src/services/notificationService');

async function testEmail() {
  console.log('=== EMAIL NOTIFICATION TEST ===\n');
  
  console.log('Sending test email...');
  
  const result = await sendNotification(
    '🧪 Test Email dari SecMonitor',
    `Ini adalah test email untuk memastikan konfigurasi SMTP berfungsi dengan baik.

📧 Email Configuration:
- SMTP Host: smtp.gmail.com
- SMTP Port: 587
- From: ismaelanmaulani068@gmail.com
- To: ismaelanmaulani068@gmail.com

✅ Jika Anda menerima email ini, berarti konfigurasi sudah benar!

Timestamp: ${new Date().toLocaleString('id-ID')}`
  );
  
  if (result) {
    console.log('\n✅ Email sent successfully!');
    console.log('📬 Check your inbox: ismaelanmaulani068@gmail.com');
    console.log('📁 Also check spam/junk folder if not in inbox');
  } else {
    console.log('\n❌ Failed to send email');
    console.log('💡 Check the error messages above');
  }
  
  console.log('\n=== TEST COMPLETE ===');
  process.exit(0);
}

testEmail();
