import React, { useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertOctagon } from 'lucide-react';

export default function Toast({ message, type = 'info', onClose, duration = 4000 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeStyles = {
    success: 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300 neon-glow-green',
    error: 'bg-rose-950/90 border-rose-500/30 text-rose-300',
    warning: 'bg-amber-950/90 border-amber-500/30 text-amber-300',
    info: 'bg-indigo-950/90 border-indigo-500/30 text-indigo-300 neon-glow-violet',
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
    error: <AlertOctagon className="w-5 h-5 text-rose-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    info: <Info className="w-5 h-5 text-indigo-400" />,
  };

  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 animate-slide-in ${typeStyles[type]}`}>
      {icons[type]}
      <p className="text-sm font-medium pr-2">{message}</p>
      <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors ml-auto">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
