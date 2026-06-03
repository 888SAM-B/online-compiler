import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Terminal, LogOut, User, Shield, Menu } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="glass-nav sticky top-0 z-40 w-full px-6 py-4 flex items-center justify-between text-gray-100">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-dark-800 rounded-lg lg:hidden transition-colors"
          aria-label="Toggle Sidebar"
        >
          <Menu className="w-6 h-6" />
        </button>
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="bg-gradient-to-tr from-brand-purple to-brand-violet p-2 rounded-xl text-white shadow-lg shadow-brand-purple/20">
            <Terminal className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            Dev<span className="text-brand-purple">Sandbox</span>
          </span>
        </Link>
      </div>

      {user && (
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 px-3 py-1.5 rounded-xl border border-white/5 hover:border-brand-purple/20 bg-dark-900/60 hover:bg-dark-800/80 transition-all duration-300"
          >
            <div className="w-8 h-8 rounded-lg bg-brand-purple/10 border border-brand-purple/30 text-brand-purple flex items-center justify-center font-bold text-sm">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-sm font-medium leading-none">{user.name}</span>
              <span className="text-[10px] text-gray-400 mt-0.5 capitalize flex items-center gap-1">
                {user.role === 'admin' && <Shield className="w-2.5 h-2.5 text-brand-teal" />}
                {user.role}
              </span>
            </div>
          </button>

          {dropdownOpen && (
            <>
              {/* Overlay to close dropdown */}
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)}></div>
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/5 bg-dark-900/90 backdrop-blur-xl p-2 shadow-2xl z-20 animate-fade-in">
                <div className="px-3 py-2 border-b border-white/5 text-left mb-1">
                  <p className="text-sm font-medium truncate">{user.name}</p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                <Link
                  to="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-brand-purple/10 rounded-lg transition-all"
                >
                  <User className="w-4 h-4 text-brand-purple" />
                  My Profile
                </Link>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-brand-teal/10 rounded-lg transition-all"
                  >
                    <Shield className="w-4 h-4 text-brand-teal" />
                    Admin Panel
                  </Link>
                )}
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all text-left mt-1"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}
