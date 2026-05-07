const nodemailer = require('nodemailer');
const axios = require('axios');
const { pool } = require('../config/database');

async function getSetting(key) {
  const [rows] = await pool.query('SELECT value FROM settings WHERE key_name = ?', [key]);
  return rows[0]?.value || '';
}

// Send email notification
async function sendEmailNotification(subject, message) {
  try {
    const enabled = await getSetting('email_notifications_enabled');
    if (enabled !== '1') {
      console.log('[NOTIFICATION] Email notifications disabled');
      return false;
    }

    const host = await getSetting('email_smtp_host');
    const port = await getSetting('email_smtp_port');
    const user = await getSetting('email_smtp_user');
    const password = await getSetting('email_smtp_password');
    const from = await getSetting('email_from');
    const to = await getSetting('email_to');

    if (!host || !user || !password || !from || !to) {
      console.log('[NOTIFICATION] Email settings incomplete');
      return false;
    }

    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port) || 587,
      secure: parseInt(port) === 465,
      auth: { user, pass: password },
      family: 4, // Force IPv4
      dnsTimeout: 10000,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    const recipients = to.split(',').map(e => e.trim()).filter(e => e);

    await transporter.sendMail({
      from,
      to: recipients.join(', '),
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">🛡️ SecMonitor Alert</h1>
          </div>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">${subject}</h2>
            <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea;">
              ${message}
            </div>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              Notifikasi otomatis dari SecMonitor Dashboard<br>
              ${new Date().toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      `,
    });

    console.log('[NOTIFICATION] Email sent successfully');
    return true;
  } catch (err) {
    console.error('[NOTIFICATION] Email error:', err.message);
    return false;
  }
}

// Send Telegram notification
async function sendTelegramNotification(message) {
  try {
    const enabled = await getSetting('telegram_notifications_enabled');
    if (enabled !== '1') {
      console.log('[NOTIFICATION] Telegram notifications disabled');
      return false;
    }

    const botToken = await getSetting('telegram_bot_token');
    const chatId = await getSetting('telegram_chat_id');

    if (!botToken || !chatId) {
      console.log('[NOTIFICATION] Telegram settings incomplete');
      return false;
    }

    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: `🛡️ *SecMonitor Alert*\n\n${message}\n\n_${new Date().toLocaleString('id-ID')}_`,
      parse_mode: 'Markdown',
    }, { timeout: 10000 });

    console.log('[NOTIFICATION] Telegram message sent successfully');
    return true;
  } catch (err) {
    console.error('[NOTIFICATION] Telegram error:', err.message);
    return false;
  }
}

// Send notification via all enabled channels
async function sendNotification(subject, message) {
  const results = await Promise.allSettled([
    sendEmailNotification(subject, message),
    sendTelegramNotification(`*${subject}*\n\n${message}`),
  ]);

  const success = results.some(r => r.status === 'fulfilled' && r.value === true);
  return success;
}

module.exports = {
  sendEmailNotification,
  sendTelegramNotification,
  sendNotification,
};
