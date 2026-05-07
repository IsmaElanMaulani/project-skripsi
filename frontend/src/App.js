import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CloudflarePage from './pages/CloudflarePage';
import IPCheckPage from './pages/IPCheckPage';
import MalwarePage from './pages/MalwarePage';
import CVEPage from './pages/CVEPage';
import DomainMonitoringPage from './pages/DomainMonitoringPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import ActivityLogsPage from './pages/ActivityLogsPage';

function PrivateRoute({ children, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-cyber-bg">
      <div className="text-cyber-accent animate-pulse text-xl">Memuat...</div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="cloudflare" element={<CloudflarePage />} />
            <Route path="ip-check" element={<IPCheckPage />} />
            <Route path="malware" element={<MalwarePage />} />
            <Route path="cve" element={<CVEPage />} />
            <Route path="domain-monitoring" element={<DomainMonitoringPage />} />
            <Route path="users" element={<PrivateRoute adminOnly><UsersPage /></PrivateRoute>} />
            <Route path="settings" element={<PrivateRoute adminOnly><SettingsPage /></PrivateRoute>} />
            <Route path="activity-logs" element={<PrivateRoute adminOnly><ActivityLogsPage /></PrivateRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
