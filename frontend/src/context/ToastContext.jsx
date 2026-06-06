import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertOctagon } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg, duration) => showToast(msg, 'success', duration),
    error: (msg, duration) => showToast(msg, 'error', duration),
    warning: (msg, duration) => showToast(msg, 'warning', duration),
    info: (msg, duration) => showToast(msg, 'info', duration),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Container: top-right stacked */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }) {
  const { id, message, type, duration } = toast;

  React.useEffect(() => {
    const timer = setTimeout(() => onRemove(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onRemove]);

  const typeStyles = {
    success: 'bg-emerald-950/95 border-emerald-500/30 text-emerald-200',
    error:   'bg-rose-950/95 border-rose-500/30 text-rose-200',
    warning: 'bg-amber-950/95 border-amber-500/30 text-amber-200',
    info:    'bg-indigo-950/95 border-indigo-500/30 text-indigo-200',
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />,
    error:   <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    info:    <Info className="w-5 h-5 text-indigo-400 shrink-0" />,
  };

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl max-w-sm w-full animate-slide-in ${typeStyles[type]}`}
      style={{ animation: 'slideInRight 0.3s ease-out' }}
    >
      {icons[type]}
      <p className="text-sm font-medium leading-snug flex-1">{message}</p>
      <button
        onClick={() => onRemove(id)}
        className="p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0 mt-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
