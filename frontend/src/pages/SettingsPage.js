import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Cog6ToothIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const SETTING_LABELS = {
  auto_scan_enabled: { label: 'Auto Scan Malware', type: 'toggle', desc: 'Aktifkan pemeriksaan scan otomatis' },
  auto_scan_interval: { label: 'Interval Auto Scan (menit)', type: 'number', desc: 'Seberapa sering auto scan berjalan' },
  auto_fetch_logs_enabled: { label: 'Auto Fetch Logs', type: 'toggle', desc: 'Aktifkan pengambilan log otomatis' },
  auto_fetch_logs_interval: { label: 'Interval Fetch Logs (menit)', type: 'number', desc: 'Seberapa sering log diambil' },
  abuse_score_threshold: { label: 'Threshold Suspicious', type: 'number', desc: 'Skor minimum untuk status mencurigakan' },
  abuse_score_danger: { label: 'Threshold Berbahaya', type: 'number', desc: 'Skor minimum untuk status berbahaya' },
  notification_high_severity: { label: 'Notifikasi Realtime High Severity', type: 'toggle', desc: 'Tampilkan notifikasi popup untuk ancaman tinggi' },
  cloudflare_api_token: { label: 'Cloudflare API Token / Global API Key', type: 'text', desc: 'API Token atau Global API Key', secret: true },
  cloudflare_email: { label: 'Cloudflare Email (untuk Global API Key)', type: 'text', desc: 'Email akun Cloudflare (hanya jika pakai Global API Key)' },
  cloudflare_account_id: { label: 'Cloudflare Account ID', type: 'text', desc: 'Account ID Cloudflare Anda (WAJIB untuk multi-zone)' },
  cloudflare_zone_id: { label: 'Cloudflare Zone ID (Opsional)', type: 'text', desc: 'Tidak diperlukan - sistem auto-detect semua zones' },
  email_notifications_enabled: { label: 'Email Notifications', type: 'toggle', desc: 'Aktifkan notifikasi via email' },
  email_smtp_host: { label: 'SMTP Host', type: 'text', desc: 'Server SMTP (contoh: smtp.gmail.com)' },
  email_smtp_port: { label: 'SMTP Port', type: 'number', desc: 'Port SMTP (biasanya 587 atau 465)' },
  email_smtp_user: { label: 'SMTP Username', type: 'text', desc: 'Username untuk autentikasi SMTP' },
  email_smtp_password: { label: 'SMTP Password', type: 'text', desc: 'Password untuk autentikasi SMTP', secret: true },
  email_from: { label: 'Email Pengirim', type: 'text', desc: 'Alamat email pengirim' },
  email_to: { label: 'Email Penerima', type: 'text', desc: 'Alamat email penerima (pisahkan dengan koma)' },
  telegram_notifications_enabled: { label: 'Telegram Notifications', type: 'toggle', desc: 'Aktifkan notifikasi via Telegram' },
  telegram_bot_token: { label: 'Telegram Bot Token', type: 'text', desc: 'Token bot Telegram', secret: true },
  telegram_chat_id: { label: 'Telegram Chat ID', type: 'text', desc: 'Chat ID untuk menerima notifikasi' },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await api.get('/settings');
      const flat = {};
      Object.entries(res.data.settings || {}).forEach(([k, v]) => { flat[k] = v.value; });
      setSettings(flat);
    } catch { }
    finally { setLoading(false); }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.put('/settings', { settings });
      setMsg({ type: 'success', text: 'Pengaturan berhasil disimpan' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal menyimpan' });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestCloudflare() {
    setTesting(true);
    setMsg(null);
    try {
      const res = await api.get('/cloudflare/test');
      if (res.data.success) {
        setMsg({ 
          type: 'success', 
          text: `✓ ${res.data.message} - Zone: ${res.data.details?.zoneName || 'N/A'}` 
        });
      } else {
        setMsg({ 
          type: 'error', 
          text: `✗ ${res.data.message}${res.data.error ? ': ' + res.data.error : ''}` 
        });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Gagal test koneksi: ' + (err.response?.data?.message || err.message) });
    } finally {
      setTesting(false);
    }
  }

  async function handleTestEmail() {
    setTesting(true);
    setMsg(null);
    try {
      const res = await api.post('/test-notification');
      if (res.data.success) {
        setMsg({ 
          type: 'success', 
          text: `✅ ${res.data.message} Email dikirim ke: ${res.data.email}` 
        });
      } else {
        setMsg({ 
          type: 'error', 
          text: `❌ ${res.data.message}` 
        });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Gagal mengirim email: ' + (err.response?.data?.message || err.message) });
    } finally {
      setTesting(false);
    }
  }

  function handleChange(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) return <div className="text-center py-12 text-gray-500">Memuat pengaturan...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Cog6ToothIcon className="w-6 h-6 text-cyber-accent" /> Pengaturan Sistem
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Konfigurasi cronjob dan threshold keamanan</p>
        </div>
        <button onClick={fetchSettings} className="cyber-btn-ghost flex items-center gap-2 text-xs">
          <ArrowPathIcon className="w-4 h-4" /> Refresh
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {/* Cronjob Settings */}
        <div className="cyber-card p-5">
          <h2 className="text-sm font-medium text-gray-300 mb-4 pb-3 border-b border-cyber-border">⏱ Cronjob Settings</h2>
          <div className="space-y-4">
            {['auto_scan_enabled', 'auto_scan_interval', 'auto_fetch_logs_enabled', 'auto_fetch_logs_interval'].map((key) => (
              <SettingRow key={key} settingKey={key} value={settings[key]} onChange={handleChange} />
            ))}
          </div>
        </div>

        {/* Threshold Settings */}
        <div className="cyber-card p-5">
          <h2 className="text-sm font-medium text-gray-300 mb-4 pb-3 border-b border-cyber-border">🎯 Threshold Keamanan</h2>
          <div className="space-y-4">
            {['abuse_score_threshold', 'abuse_score_danger'].map((key) => (
              <SettingRow key={key} settingKey={key} value={settings[key]} onChange={handleChange} />
            ))}
          </div>
        </div>

        {/* Notification Settings */}
        <div className="cyber-card p-5">
          <h2 className="text-sm font-medium text-gray-300 mb-4 pb-3 border-b border-cyber-border">🔔 Notifikasi</h2>
          <div className="space-y-4">
            {['notification_high_severity'].map((key) => (
              <SettingRow key={key} settingKey={key} value={settings[key]} onChange={handleChange} />
            ))}
          </div>
        </div>

        {/* Cloudflare API Settings */}
        <div className="cyber-card p-5 border-l-4 border-orange-500">
          <div className="flex items-start gap-3 mb-4 pb-3 border-b border-cyber-border">
            <div className="flex-1">
              <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                ☁️ Cloudflare API Configuration
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Konfigurasi API Cloudflare untuk mengambil Security Logs secara otomatis
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {['cloudflare_api_token', 'cloudflare_email', 'cloudflare_account_id'].map((key) => (
              <SettingRow key={key} settingKey={key} value={settings[key]} onChange={handleChange} />
            ))}
          </div>
          <div className="mt-4 p-3 bg-blue-900 bg-opacity-20 border border-blue-700 border-opacity-30 rounded-lg">
            <div className="text-xs text-blue-300">
              <div className="font-semibold mb-1">📖 Cara Setup (Pilih salah satu):</div>
              
              <div className="mt-2 font-semibold text-blue-200">Opsi 1: API Token (Recommended)</div>
              <ol className="list-decimal list-inside space-y-1 text-blue-400 ml-2">
                <li>Buat Custom Token dengan permission: Zone Analytics + Zone Logs</li>
                <li>Paste API Token</li>
                <li>Kosongkan Email</li>
              </ol>
              
              <div className="mt-2 font-semibold text-blue-200">Opsi 2: Global API Key (Mudah)</div>
              <ol className="list-decimal list-inside space-y-1 text-blue-400 ml-2">
                <li>Copy Global API Key: <code className="bg-blue-950 px-1 rounded">bc2c87e4f2882c6680326182824172270</code></li>
                <li>Paste ke field "API Token"</li>
                <li>Isi Email Cloudflare Anda</li>
                <li>Copy Account ID dari URL dashboard</li>
              </ol>
            </div>
          </div>
          <div className="mt-3 p-3 bg-green-900 bg-opacity-20 border border-green-700 border-opacity-30 rounded-lg">
            <div className="text-xs text-green-300">
              <div className="font-semibold mb-1">✅ Keuntungan Setup Ini:</div>
              <ul className="list-disc list-inside space-y-1 text-green-400">
                <li><strong>Auto-detect semua zones</strong> - tidak perlu input Zone ID manual</li>
                <li><strong>Fetch logs dari semua domain</strong> dalam 1 akun sekaligus</li>
                <li><strong>Sync domains otomatis</strong> ke Domain Monitoring</li>
              </ul>
            </div>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={handleTestCloudflare}
              disabled={testing || !settings.cloudflare_api_token || !settings.cloudflare_zone_id}
              className="cyber-btn-ghost flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {testing ? (
                <>
                  <div className="w-4 h-4 border-2 border-cyber-accent border-t-transparent rounded-full animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" />
                  Test Koneksi Cloudflare
                </>
              )}
            </button>
          </div>
        </div>

        {/* Email Notification Settings */}
        <div className="cyber-card p-5 border-l-4 border-green-500">
          <div className="flex items-start gap-3 mb-4 pb-3 border-b border-cyber-border">
            <div className="flex-1">
              <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                📧 Email Notifications
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Konfigurasi SMTP untuk notifikasi email otomatis
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {['email_notifications_enabled', 'email_smtp_host', 'email_smtp_port', 'email_smtp_user', 'email_smtp_password', 'email_from', 'email_to'].map((key) => (
              <SettingRow key={key} settingKey={key} value={settings[key]} onChange={handleChange} />
            ))}
          </div>
          <div className="mt-4 p-3 bg-blue-900 bg-opacity-20 border border-blue-700 border-opacity-30 rounded-lg">
            <div className="text-xs text-blue-300">
              <div className="font-semibold mb-1">📖 Contoh konfigurasi Gmail:</div>
              <ul className="list-disc list-inside space-y-1 text-blue-400">
                <li>SMTP Host: smtp.gmail.com</li>
                <li>SMTP Port: 587</li>
                <li>Username: email@gmail.com</li>
                <li>Password: App Password (bukan password Gmail biasa)</li>
              </ul>
            </div>
          </div>
          <div className="mt-3">
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testing || settings.email_notifications_enabled !== '1'}
              className="cyber-btn-ghost flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {testing ? (
                <>
                  <div className="w-4 h-4 border-2 border-cyber-accent border-t-transparent rounded-full animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" />
                  Kirim Test Email
                </>
              )}
            </button>
          </div>
        </div>

        {/* Telegram Notification Settings */}
        <div className="cyber-card p-5 border-l-4 border-blue-500">
          <div className="flex items-start gap-3 mb-4 pb-3 border-b border-cyber-border">
            <div className="flex-1">
              <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                💬 Telegram Notifications
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Konfigurasi Telegram Bot untuk notifikasi realtime
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {['telegram_notifications_enabled', 'telegram_bot_token', 'telegram_chat_id'].map((key) => (
              <SettingRow key={key} settingKey={key} value={settings[key]} onChange={handleChange} />
            ))}
          </div>
          <div className="mt-4 p-3 bg-blue-900 bg-opacity-20 border border-blue-700 border-opacity-30 rounded-lg">
            <div className="text-xs text-blue-300">
              <div className="font-semibold mb-1">📖 Cara setup Telegram Bot:</div>
              <ol className="list-decimal list-inside space-y-1 text-blue-400">
                <li>Chat dengan <span className="font-mono">@BotFather</span> di Telegram</li>
                <li>Kirim <span className="font-mono">/newbot</span> dan ikuti instruksi</li>
                <li>Copy Bot Token yang diberikan</li>
                <li>Chat dengan bot Anda, lalu buka: <span className="font-mono">https://api.telegram.org/bot[TOKEN]/getUpdates</span></li>
                <li>Cari "chat":{"{"}"id": untuk mendapatkan Chat ID</li>
              </ol>
            </div>
          </div>
        </div>

        {msg && (
          <div className={`text-sm px-4 py-3 rounded-lg ${msg.type === 'success' ? 'bg-green-900 bg-opacity-30 text-green-400 border border-green-700 border-opacity-40' : 'bg-red-900 bg-opacity-30 text-red-400 border border-red-700 border-opacity-40'}`}>
            {msg.text}
          </div>
        )}

        <button type="submit" disabled={saving} className="cyber-btn-primary flex items-center gap-2">
          <CheckIcon className="w-4 h-4" />
          {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </form>
    </div>
  );
}

function SettingRow({ settingKey, value, onChange }) {
  const meta = SETTING_LABELS[settingKey];
  if (!meta) return null;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <div className="text-sm text-gray-200">{meta.label}</div>
        <div className="text-xs text-gray-500 mt-0.5">{meta.desc}</div>
      </div>
      {meta.type === 'toggle' ? (
        <button
          type="button"
          onClick={() => onChange(settingKey, value === '1' ? '0' : '1')}
          className={`relative w-12 h-6 rounded-full transition-colors ${value === '1' ? 'bg-cyber-accent' : 'bg-cyber-border'}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${value === '1' ? 'left-7' : 'left-1'}`} />
        </button>
      ) : meta.type === 'text' ? (
        <input
          type={meta.secret ? 'password' : 'text'}
          className="cyber-input flex-1 max-w-md font-mono text-xs"
          value={value || ''}
          onChange={(e) => onChange(settingKey, e.target.value)}
          placeholder={meta.secret ? '••••••••••••••••' : 'Masukkan ' + meta.label.toLowerCase()}
        />
      ) : (
        <input
          type="number"
          className="cyber-input w-24 text-center"
          value={value || ''}
          onChange={(e) => onChange(settingKey, e.target.value)}
          min="1"
        />
      )}
    </div>
  );
}
