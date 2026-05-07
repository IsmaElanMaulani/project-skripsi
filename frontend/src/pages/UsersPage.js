import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { UsersIcon, PlusIcon, PencilIcon, TrashIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';

const emptyForm = { username: '', email: '', password: '', role: 'viewer', is_active: true };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch {}
    finally { setLoading(false); }
  }

  function openCreate() {
    setEditUser(null);
    setForm(emptyForm);
    setMsg(null);
    setShowModal(true);
  }

  function openEdit(user) {
    setEditUser(user);
    setForm({ username: user.username, email: user.email, password: '', role: user.role, is_active: !!user.is_active });
    setMsg(null);
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      if (editUser) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.put(`/users/${editUser.id}`, payload);
        setMsg({ type: 'success', text: 'User berhasil diupdate' });
      } else {
        await api.post('/users', form);
        setMsg({ type: 'success', text: 'User berhasil dibuat' });
      }
      fetchUsers();
      setTimeout(() => setShowModal(false), 1000);
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Gagal menyimpan' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user) {
    if (!window.confirm(`Hapus user "${user.username}"?`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menghapus');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <UsersIcon className="w-6 h-6 text-cyber-accent" /> User Management
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Kelola akun pengguna sistem</p>
        </div>
        <button onClick={openCreate} className="cyber-btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" /> Tambah User
        </button>
      </div>

      <div className="cyber-card p-5">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Memuat...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-cyber-border">
                  <th className="text-left pb-3 pr-4">Username</th>
                  <th className="text-left pb-3 pr-4">Email</th>
                  <th className="text-left pb-3 pr-4">Role</th>
                  <th className="text-left pb-3 pr-4">Status</th>
                  <th className="text-left pb-3 pr-4">Login Terakhir</th>
                  <th className="text-left pb-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="table-row-hover border-b border-cyber-border border-opacity-30">
                    <td className="py-3 pr-4 font-medium text-gray-200">{u.username}</td>
                    <td className="py-3 pr-4 text-gray-400 text-xs">{u.email}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${u.role === 'admin' ? 'bg-purple-900 text-purple-300' : 'bg-gray-800 text-gray-400'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs ${u.is_active ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        {u.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-500 text-xs">
                      {u.last_login ? new Date(u.last_login).toLocaleString('id-ID') : '—'}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(u)} className="text-cyber-accent hover:text-cyan-300 transition-colors">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(u)} className="text-cyber-red hover:text-red-400 transition-colors">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="cyber-card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white">{editUser ? 'Edit User' : 'Tambah User'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-300">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Username</label>
                <input className="cyber-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <input type="email" className="cyber-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Password {editUser && <span className="text-gray-600">(kosongkan jika tidak diubah)</span>}</label>
                <input type="password" className="cyber-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editUser} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Role</label>
                <select className="cyber-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="viewer">Viewer (Read Only)</option>
                  <option value="analyst">Analyst (Monitoring + Analysis)</option>
                  <option value="operator">Operator (Config + Operations)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 accent-cyan-400" />
                <label htmlFor="is_active" className="text-sm text-gray-300">Akun Aktif</label>
              </div>

              {msg && (
                <div className={`text-sm px-3 py-2 rounded-lg ${msg.type === 'success' ? 'bg-green-900 bg-opacity-30 text-green-400' : 'bg-red-900 bg-opacity-30 text-red-400'}`}>
                  {msg.text}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="cyber-btn-primary flex items-center gap-2 flex-1 justify-center">
                  <CheckIcon className="w-4 h-4" />
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="cyber-btn-ghost flex-1">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
