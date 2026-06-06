import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  Users, 
  Search, 
  Trash2, 
  UserX, 
  UserCheck, 
  ShieldAlert,
  ChevronLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Loader from '../components/Loader';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

export default function UserManagement() {
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = async (query = '') => {
    try {
      const res = await api.get(`/admin/users${query ? `?search=${query}` : ''}`);
      setUsers(res.data);
    } catch (err) {
      toast.error('Failed to retrieve user database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    fetchUsers(search);
  };

  const handleToggleBlock = async (userId, userEmail, currentBlockStatus) => {
    try {
      const res = await api.put(`/admin/users/${userId}/block`, {
        is_blocked: !currentBlockStatus
      });
      setUsers(users.map(u => u.id === userId ? res.data : u));
      toast.success(`${!currentBlockStatus ? 'Blocked' : 'Unblocked'} user ${userEmail}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update user block status');
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    const ok = await confirm({
      title: 'Delete User',
      message: `WARNING: Are you sure you want to permanently delete user "${userEmail}" and all their associated files?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true
    });
    if (!ok) return;

    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(users.filter(u => u.id !== userId));
      toast.success('User deleted successfully');
    } catch (err) {
      toast.error('Failed to delete user');
    }
  };

  if (loading) {
    return <Loader fullScreen={true} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 text-left">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link
            to="/admin"
            className="p-2 hover:bg-dark-800 rounded-xl border border-white/5 text-gray-400 hover:text-white transition animate-fade-in"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-sm text-gray-400 mt-1">
              Search, filter, block, or delete system developer accounts.
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-3.5 text-gray-500 w-4.5 h-4.5" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-dark-900 border border-white/5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple focus:border-brand-purple transition-all"
          />
        </div>
        <button
          type="submit"
          className="bg-brand-purple hover:bg-brand-purple/95 px-6 py-3 rounded-xl text-sm font-semibold transition"
        >
          Search
        </button>
      </form>

      {/* Database Listing Table */}
      <div className="glass p-6 rounded-2xl flex flex-col min-w-0">
        <div className="overflow-x-auto min-h-[300px]">
          {users.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 py-12 gap-3">
              <Users className="w-12 h-12 text-gray-600" />
              <p>No user accounts matching search parameters.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-white/5 pb-2 text-xs uppercase font-bold tracking-wider">
                  <th className="text-left pb-3 font-semibold">User Details</th>
                  <th className="text-left pb-3 font-semibold">Role</th>
                  <th className="text-left pb-3 font-semibold">Joined Date</th>
                  <th className="text-left pb-3 font-semibold">Account Status</th>
                  <th className="text-right pb-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    {/* User profile */}
                    <td className="py-4 pr-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-purple/10 text-brand-purple flex items-center justify-center font-bold text-sm">
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="font-semibold text-gray-200">{item.name}</span>
                        <span className="text-xs text-gray-500">{item.email}</span>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-4 pr-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${
                        item.role === 'admin' 
                          ? 'bg-brand-teal/10 border-brand-teal/20 text-brand-teal' 
                          : 'bg-white/5 border-white/10 text-gray-400'
                      }`}>
                        {item.role}
                      </span>
                    </td>

                    {/* Joined Date */}
                    <td className="py-4 pr-3 text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>

                    {/* Block status */}
                    <td className="py-4 pr-3 text-xs">
                      {item.is_blocked ? (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Blocked
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold">Active</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleBlock(item.id, item.email, item.is_blocked)}
                        title={item.is_blocked ? 'Unblock user' : 'Block user'}
                        className={`p-1.5 rounded-lg border transition ${
                          item.is_blocked
                            ? 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'
                            : 'border-white/5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10'
                        }`}
                      >
                        {item.is_blocked ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(item.id, item.email)}
                        title="Delete user account"
                        className="p-1.5 border border-white/5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition animate-fade-in"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
