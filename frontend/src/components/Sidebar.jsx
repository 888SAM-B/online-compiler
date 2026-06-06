import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Code2, 
  FolderGit2, 
  History, 
  User, 
  ShieldAlert, 
  Users, 
  BarChart3,
  X,
  Trophy,
  Target,
  Settings,
  Share2,
  Award
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();

  const baseLinkStyle = "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 border border-transparent";
  const activeStyle = "bg-brand-purple/10 border-brand-purple/20 text-white shadow-lg shadow-brand-purple/5";
  const inactiveStyle = "text-gray-400 hover:text-gray-200 hover:bg-dark-800/50 hover:border-white/5";

  const getLinkClass = ({ isActive }) => 
    `${baseLinkStyle} ${isActive ? activeStyle : inactiveStyle}`;

  const navItems = [
    { to: '/dashboard', label: 'Code Editor', icon: <Code2 className="w-5 h-5" /> },
    { to: '/challenges', label: 'Challenges', icon: <Target className="w-5 h-5" /> },
    { to: '/assessments', label: 'Certifications', icon: <Award className="w-5 h-5" /> },
    { to: '/leaderboard', label: 'Leaderboard', icon: <Trophy className="w-5 h-5" /> },
    { to: '/programs', label: 'My Programs', icon: <FolderGit2 className="w-5 h-5" /> },
    { to: '/shared-codes', label: 'Shared Codes', icon: <Share2 className="w-5 h-5" /> },
    { to: '/history', label: 'Execution History', icon: <History className="w-5 h-5" /> },
    { to: '/profile', label: 'My Profile', icon: <User className="w-5 h-5" /> },
  ];

  const adminItems = [
    { to: '/admin', label: 'System Logs', icon: <ShieldAlert className="w-5 h-5" /> },
    { to: '/admin/users', label: 'User Management', icon: <Users className="w-5 h-5" /> },
    { to: '/admin/challenges', label: 'Manage Challenges', icon: <Settings className="w-5 h-5" /> },
    { to: '/admin/assessments', label: 'Manage Assessments', icon: <Award className="w-5 h-5" /> },
    { to: '/admin/certificates', label: 'Manage Certificates', icon: <Award className="w-5 h-5 text-amber-400" /> },
    { to: '/admin/analytics', label: 'Analytics Panel', icon: <BarChart3 className="w-5 h-5" /> },
  ];

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div 
          onClick={onClose} 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
        ></div>
      )}

      <aside className={`
        fixed top-0 bottom-0 left-0 w-64 border-r border-white/5 bg-dark-950 flex flex-col z-50
        transition-transform duration-300 lg:relative lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Mobile Header / Close button */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 lg:hidden">
          <span className="font-bold text-lg">Menu</span>
          <button onClick={onClose} className="p-1 hover:bg-dark-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6">
          {/* User Workspace Section */}
          <div className="flex flex-col gap-1.5">
            <h3 className="px-4 text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Workspace
            </h3>
            {navItems.map((item) => (
              <NavLink 
                key={item.to} 
                to={item.to} 
                onClick={onClose}
                className={getLinkClass}
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Admin Operations Section */}
          {user && user.role === 'admin' && (
            <div className="flex flex-col gap-1.5 border-t border-white/5 pt-6">
              <h3 className="px-4 text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                Administration
              </h3>
              {adminItems.map((item) => (
                <NavLink 
                  key={item.to} 
                  to={item.to} 
                  onClick={onClose}
                  className={getLinkClass}
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-white/5 bg-dark-900/40">
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse"></div>
            <span className="text-xs text-gray-500 font-medium">Sandbox Connected</span>
          </div>
        </div>
      </aside>
    </>
  );
}
