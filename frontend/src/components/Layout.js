import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { io } from 'socket.io-client';
import {
  HomeIcon, ShieldCheckIcon, GlobeAltIcon, BugAntIcon, ExclamationTriangleIcon,
  UsersIcon, Cog6ToothIcon, Bars3Icon, XMarkIcon, BellIcon, ArrowRightOnRectangleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { to: '/', label: 'Dashboard', icon: HomeIcon, exact: true },
  { to: '/cloudflare', label: 'Security Logs', icon: ShieldCheckIcon },
  { to: '/ip-check', label: 'IP Threat Check', icon: GlobeAltIcon },
  { to: '/malware', label: 'Malware Scanner', icon: BugAntIcon },
  { to: '/cve', label: 'Newest Vulnerability', icon: ExclamationTriangleIcon },
  { to: '/domain-monitoring', label: 'Domain Monitoring', icon: GlobeAltIcon },
  { to: '/users', label: 'User Management', icon: UsersIcon, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Cog6ToothIcon, adminOnly: true },
  { to: '/activity-logs', label: 'Activity Logs', icon: ClockIcon, adminOnly: true },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchNotifications();
    const socket = io('http://localhost:5000', { transports: ['websocket'] });
    socket.on('notifications', (data) => {
      setAlerts(data.slice(0, 3));
      setUnread((prev) => prev + data.length);
      setTimeout(() => setAlerts([]), 5000);
    });
    return () => socket.disconnect();
  }, []);

  async function fetchNotifications() {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnread(res.data.unread || 0);
    } catch {}
  }

  async function markAllRead() {
    try {
      await api.put('/notifications/all/read');
      setUnread(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch {}
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleNav = navItems.filter((n) => !n.adminOnly || user?.role === 'admin');

  return (
    <div className="flex h-screen overflow-hidden bg-cyber-bg">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 flex flex-col flex-shrink-0 bg-cyber-card border-r border-cyber-border`}>
        
        {/* Sidebar Header */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-cyber-border">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyber-accent to-blue-500 flex items-center justify-center flex-shrink-0">
            <ShieldCheckIcon className="w-6 h-6 text-white" />
          </div>
          {sidebarOpen && (
            <div className="flex-1">
              <h5 className="text-white font-bold text-base mb-0">SecMonitor</h5>
              <p className="text-xs text-gray-500">Security Dashboard</p>
            </div>
          )}
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {visibleNav.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-all text-sm font-medium ${
                  isActive
                    ? 'sidebar-link-active text-cyber-accent'
                    : 'text-gray-400 hover:bg-cyber-border hover:bg-opacity-50 hover:text-gray-200'
                }`
              }
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        {sidebarOpen && (
          <div className="p-4 border-t border-cyber-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyber-accent to-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium truncate">{user?.username}</div>
                <div className="text-xs text-gray-500 capitalize">{user?.role}</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-6 py-4 flex items-center justify-between flex-shrink-0 bg-cyber-card bg-opacity-50 backdrop-blur-xl border-b border-cyber-border">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} 
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-cyber-border hover:bg-opacity-50 rounded-lg">
            {sidebarOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
          </button>
          
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => { setShowNotif(!showNotif); if (!showNotif) fetchNotifications(); }}
                className="relative text-gray-400 hover:text-white transition-colors p-2 hover:bg-cyber-border hover:bg-opacity-50 rounded-lg"
              >
                <BellIcon className="w-6 h-6" />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold shadow-lg">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              
              {showNotif && (
                <div className="absolute right-0 top-12 w-96 cyber-card max-h-96 overflow-hidden animate-fadeIn z-50">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-cyber-border">
                    <span className="text-sm font-semibold text-white">Notifications</span>
                    {unread > 0 && (
                      <button onClick={markAllRead} className="text-xs text-cyber-accent hover:underline font-medium">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="overflow-y-auto max-h-80">
                    {notifications.length === 0 ? (
                      <div className="px-5 py-8 text-center text-sm text-gray-500">No notifications</div>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div key={n.id} className={`px-5 py-4 hover:bg-cyber-border hover:bg-opacity-30 transition-colors border-b border-cyber-border border-opacity-50 ${!n.is_read ? 'bg-cyber-border bg-opacity-20' : ''}`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${n.severity === 'critical' ? 'bg-red-500 bg-opacity-20' : 'bg-yellow-500 bg-opacity-20'}`}>
                              <ExclamationTriangleIcon className={`w-5 h-5 ${n.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-white">{n.title}</div>
                              <div className="text-xs text-gray-400 mt-1 line-clamp-2">{n.message}</div>
                              <div className="text-xs text-gray-600 mt-2">
                                {new Date(n.created_at).toLocaleString('id-ID')}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Logout */}
            <button onClick={handleLogout} 
              className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors text-sm font-medium px-3 py-2 hover:bg-cyber-border hover:bg-opacity-50 rounded-lg">
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="fixed top-6 right-6 z-50 space-y-3">
            {alerts.map((a, i) => (
              <div key={i} className="bg-red-500 rounded-xl px-5 py-4 text-white text-sm max-w-sm shadow-2xl animate-fadeIn border border-red-400">
                <div className="flex items-start gap-3">
                  <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">{a.title}</div>
                    <div className="text-xs mt-1 opacity-90">{a.message}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
