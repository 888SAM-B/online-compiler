import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  BarChart3, 
  Users, 
  Terminal, 
  FolderHeart, 
  Cpu, 
  ArrowUpRight, 
  TrendingUp,
  ChevronLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Loader from '../components/Loader';
import Toast from '../components/Toast';

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await api.get('/admin/analytics');
        setData(res.data);
      } catch (err) {
        setToast({ message: 'Failed to retrieve usage analytics', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return <Loader fullScreen={true} />;
  }

  // Cards mapping for dynamic rendering
  const cards = [
    {
      title: 'Total Users',
      value: data.total_users,
      icon: <Users className="w-5 h-5 text-brand-purple" />,
      bg: 'bg-brand-purple/10 border-brand-purple/20'
    },
    {
      title: 'Active Users (7d)',
      value: data.active_users,
      icon: <TrendingUp className="w-5 h-5 text-brand-teal" />,
      bg: 'bg-brand-teal/10 border-brand-teal/20'
    },
    {
      title: 'Total Code Executions',
      value: data.total_executions,
      icon: <Terminal className="w-5 h-5 text-brand-green" />,
      bg: 'bg-brand-green/10 border-brand-green/20'
    },
    {
      title: 'Programs Saved',
      value: data.programs_created,
      icon: <FolderHeart className="w-5 h-5 text-brand-orange" />,
      bg: 'bg-brand-orange/10 border-brand-orange/20'
    }
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 text-left">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link
            to="/admin"
            className="p-2 hover:bg-dark-800 rounded-xl border border-white/5 text-gray-400 hover:text-white transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics Panel</h1>
            <p className="text-sm text-gray-400 mt-1">
              Deep dive telemetry regarding database growth, language distribution, and daily executions.
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((c, index) => (
          <div key={index} className="glass p-6 rounded-2xl flex items-center justify-between border border-white/5 shadow-md hover:border-brand-purple/10 transition duration-300">
            <div className="flex flex-col gap-1 text-left">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{c.title}</span>
              <span className="text-2xl font-bold text-gray-100">{c.value}</span>
            </div>
            <div className={`p-3.5 rounded-2xl border ${c.bg}`}>
              {c.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Charts Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Daily Execution Area Chart */}
        <div className="lg:col-span-2 glass p-6 rounded-2xl flex flex-col h-[380px] min-w-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold">Daily Code Executions</h2>
            <span className="text-xs text-brand-purple flex items-center gap-1 font-semibold">
              Last 7 Days
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>

          <div className="flex-1 w-full text-xs font-mono text-gray-500">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily_executions} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" opacity={0.5} />
                <XAxis dataKey="date" stroke="#4b5563" />
                <YAxis stroke="#4b5563" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0b0f19', 
                    borderColor: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    color: '#f3f4f6'
                  }} 
                />
                <Area type="monotone" dataKey="count" name="Executions" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Highlight Metrics */}
        <div className="glass p-6 rounded-2xl flex flex-col justify-between">
          <div className="flex flex-col text-left">
            <h2 className="text-lg font-bold mb-4">Popularity Statistics</h2>
            <p className="text-xs text-gray-500 mb-6">
              Insights regarding preferred developer runtimes based on compilation volumes.
            </p>

            <div className="flex flex-col gap-5">
              <div className="bg-dark-950/40 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-purple/10 text-brand-purple p-2.5 rounded-xl">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Most Used Language</span>
                    <span className="font-bold text-gray-200 mt-0.5">{data.most_used_language}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 border-t border-white/5 pt-4 text-center">
            <div className="text-xs text-gray-500 italic">
              Telemetry metrics update automatically in real-time as users submit code jobs.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
