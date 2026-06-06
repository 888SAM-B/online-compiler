import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    // options: { title, message, confirmText, cancelText, danger }
    // OR just a string message
    const opts = typeof options === 'string'
      ? { title: 'Confirm Action', message: options, confirmText: 'Confirm', cancelText: 'Cancel', danger: false }
      : { title: 'Confirm Action', confirmText: 'Confirm', cancelText: 'Cancel', danger: false, ...options };

    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog(opts);
    });
  }, []);

  const handleConfirm = () => {
    resolverRef.current?.(true);
    setDialog(null);
  };

  const handleCancel = () => {
    resolverRef.current?.(false);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998] flex items-center justify-center p-4">
          <div
            className="bg-dark-900 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
            style={{ animation: 'slideInRight 0.2s ease-out' }}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex items-start gap-4">
              <div className={`p-2.5 rounded-2xl shrink-0 ${dialog.danger ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                {dialog.danger
                  ? <AlertTriangle className="w-5 h-5 text-rose-400" />
                  : <HelpCircle className="w-5 h-5 text-amber-400" />
                }
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-white text-sm">{dialog.title}</h3>
                <p className="text-gray-400 text-xs mt-1.5 leading-relaxed">{dialog.message}</p>
              </div>
              <button
                onClick={handleCancel}
                className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-all shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button
                onClick={handleCancel}
                className="px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white font-bold text-xs transition-all"
              >
                {dialog.cancelText}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                  dialog.danger
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20'
                    : 'bg-brand-purple hover:bg-brand-purple/90 text-white shadow-lg shadow-brand-purple/20'
                }`}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider');
  return ctx;
}
