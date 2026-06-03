import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { 
  User, 
  Mail, 
  Shield, 
  Calendar, 
  Award, 
  Lock,
  CheckCircle,
  Loader2
} from 'lucide-react';
import Loader from '../components/Loader';
import Toast from '../components/Toast';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [stats, setStats] = useState({ programs: 0, executions: 0 });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Edit State
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const [progRes, histRes] = await Promise.all([
        api.get('/programs'),
        api.get('/history')
      ]);
      setStats({
        programs: progRes.data.length,
        executions: histRes.data.length
      });
    } catch (err) {
      console.error('Failed to load profile metrics', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setUpdating(true);
    try {
      // Direct call to update (we can put this in a user update route or simulate it if the API doesn't support profile modification. Let's make sure our auth route supports updating users or define a custom user update endpoint if needed.
      // Wait, in our current admin routes, we don't have a specific user route for profile updates, but we can easily call a PUT to /programs or add a PUT /api/auth/me or update route. Let's define a PUT /api/auth/me route in the backend if we haven't. Wait! Let's check auth_routes.py. It has:
      // GET /auth/me
      // We didn't define a PUT /auth/me.
      // Let's add a PUT /auth/me to auth_routes.py if needed, or we can just send the request. Yes, let's write the frontend as sending PUT /auth/me, and then we will update auth_routes.py to support it. That's a super clean solution!)
      
      const payload = { name };
      if (password) {
        if (password.length < 6) {
          setToast({ message: 'Password must be at least 6 characters', type: 'warning' });
          setUpdating(false);
          return;
        }
        if (password !== confirmPassword) {
          setToast({ message: 'Passwords do not match', type: 'warning' });
          setUpdating(false);
          return;
        }
        payload.password = password;
      }

      await api.put('/auth/me', payload);
      await refreshUser();
      setToast({ message: 'Profile updated successfully', type: 'success' });
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to update profile', type: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <Loader fullScreen={true} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 text-left">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-sm text-gray-400 mt-1">
          Review your account metrics, update your details, or reset your login credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card Summary */}
        <div className="glass p-6 rounded-2xl flex flex-col gap-6 items-center text-center">
          <div className="w-24 h-24 rounded-2xl bg-brand-purple/10 border border-brand-purple/30 text-brand-purple flex items-center justify-center font-bold text-4xl shadow-xl shadow-brand-purple/5">
            {user?.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-200">{user?.name}</h2>
            <p className="text-xs text-gray-500 mt-1 capitalize flex items-center justify-center gap-1">
              <Shield className="w-3.5 h-3.5 text-brand-purple" />
              {user?.role} Account
            </p>
          </div>

          {/* User Stats Grid */}
          <div className="grid grid-cols-2 gap-4 w-full border-t border-white/5 pt-6">
            <div className="bg-dark-950/40 rounded-xl p-3.5 border border-white/5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 block">Programs</span>
              <span className="text-xl font-bold mt-1 block text-gray-300">{stats.programs}</span>
            </div>
            <div className="bg-dark-950/40 rounded-xl p-3.5 border border-white/5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 block">Executions</span>
              <span className="text-xl font-bold mt-1 block text-gray-300">{stats.executions}</span>
            </div>
          </div>

          {/* System metadata */}
          <div className="w-full flex flex-col gap-2 border-t border-white/5 pt-6 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-500" />
              <span className="truncate">{user?.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span>Joined {new Date(user?.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Profile Modification Form */}
        <div className="lg:col-span-2 glass p-6 rounded-2xl">
          <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
            <Lock className="w-5 h-5 text-brand-purple" />
            Update Account Settings
          </h2>

          <form onSubmit={handleUpdateProfile} className="flex flex-col gap-5 max-w-lg">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400">Display Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple focus:border-brand-purple transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400">
                New Password <span className="text-[10px] text-gray-500">(Leave blank to keep current)</span>
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple focus:border-brand-purple transition-all"
              />
            </div>

            {password && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-400">Confirm New Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple focus:border-brand-purple transition-all"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={updating}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-brand-purple to-brand-violet hover:opacity-95 px-5 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-brand-purple/20 transition-all duration-300 disabled:opacity-50 self-start"
            >
              {updating ? (
                <>
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4.5 h-4.5" />
                  Update Profile
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
