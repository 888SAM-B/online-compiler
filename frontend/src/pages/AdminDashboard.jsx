import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  ShieldAlert, 
  ToggleLeft, 
  ToggleRight, 
  Terminal, 
  Users, 
  BarChart3,
  Calendar,
  Globe,
  Award
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Loader from '../components/Loader';
import Toast from '../components/Toast';

export default function AdminDashboard() {
  const [languages, setLanguages] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const fetchData = async () => {
    try {
      const [langRes, logsRes] = await Promise.all([
        api.get('/admin/languages'),
        api.get('/admin/logs')
      ]);
      setLanguages(langRes.data);
      setLogs(logsRes.data);
    } catch (err) {
      setToast({ message: 'Failed to retrieve system settings', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleLanguage = async (langName, currentStatus) => {
    try {
      const res = await api.put(`/admin/languages/${langName}`, {
        name: langName,
        enabled: !currentStatus
      });
      setLanguages(languages.map(l => l.name === langName ? res.data : l));
      setToast({ message: `Language status updated: ${langName}`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to update language status', type: 'error' });
    }
  };

  if (loading) {
    return <Loader fullScreen={true} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 text-left">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Settings & Logs</h1>
          <p className="text-sm text-gray-400 mt-1">
            Toggle language sandboxes and review global security audit logs.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/admin/users"
            className="flex items-center gap-2 bg-dark-900 border border-white/5 hover:border-brand-purple/20 px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-300 transition"
          >
            <Users className="w-4 h-4 text-brand-purple" />
            User Management
          </Link>
          <Link
            to="/admin/certificates"
            className="flex items-center gap-2 bg-dark-900 border border-white/5 hover:border-brand-purple/20 px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-300 transition"
          >
            <Award className="w-4 h-4 text-amber-400" />
            Certificates
          </Link>
          <Link
            to="/admin/analytics"
            className="flex items-center gap-2 bg-brand-purple hover:bg-brand-purple/95 px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition shadow-lg shadow-brand-purple/20"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics Panel
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Language Management Panel */}
        <div className="glass p-6 rounded-2xl flex flex-col h-fit">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-brand-purple" />
            Supported Languages
          </h2>
          <p className="text-xs text-gray-500 mb-6">
            Enable or disable code compilation & running on the platform. Disabled environments reject code submissions.
          </p>

          <div className="flex flex-col gap-4">
            {languages.map((lang) => (
              <div
                key={lang.id}
                className="bg-dark-950/40 border border-white/5 rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-gray-200">{lang.display_name}</span>
                  <span className="text-[10px] text-gray-500 font-mono mt-0.5">{lang.docker_image}</span>
                </div>

                <button
                  onClick={() => handleToggleLanguage(lang.name, lang.enabled)}
                  className="p-1 hover:bg-white/5 rounded-lg transition"
                >
                  {lang.enabled ? (
                    <ToggleRight className="w-9 h-9 text-brand-green" />
                  ) : (
                    <ToggleLeft className="w-9 h-9 text-gray-500" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Global Security Audit Logs */}
        <div className="lg:col-span-2 glass p-6 rounded-2xl flex flex-col min-w-0">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-brand-crimson" />
            Activity Logs
          </h2>
          <div className="flex-1 overflow-x-auto min-h-[300px]">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 py-12">
                No activity logs registered.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-white/5 pb-2 text-xs uppercase font-bold tracking-wider">
                    <th className="text-left pb-3 font-semibold">User</th>
                    <th className="text-left pb-3 font-semibold">Action</th>
                    <th className="text-left pb-3 font-semibold">Details</th>
                    <th className="text-left pb-3 font-semibold">IP Address</th>
                    <th className="text-right pb-3 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono text-xs">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 pr-3 text-gray-300 truncate max-w-[150px]" title={log.email}>
                        {log.email || 'Guest'}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-brand-purple">
                        {log.action}
                      </td>
                      <td className="py-3 pr-3 text-gray-400 max-w-[200px] truncate" title={log.details}>
                        {log.details}
                      </td>
                      <td className="py-3 pr-3 text-gray-500">
                        {log.ip_address || '—'}
                      </td>
                      <td className="py-3 text-right text-gray-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
