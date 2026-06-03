import React, { useState } from 'react';
import { Play, Trash2, Copy, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';

export default function Terminal({ output, error, executionTime, loading, onClear }) {
  const [activeTab, setActiveTab] = useState('stdout');

  const handleCopy = () => {
    const textToCopy = activeTab === 'stdout' ? output : error;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
    }
  };

  const getStatusBadge = () => {
    if (loading) {
      return (
        <span className="flex items-center gap-1 text-xs bg-brand-purple/10 border border-brand-purple/20 text-brand-purple px-2.5 py-1 rounded-full font-medium">
          Running code...
        </span>
      );
    }
    
    // If we have an error and no stdout, it is definitely a failure
    // If we have both stdout and stderr, we flag it as Warning/Error
    if (error) {
      const isTimeout = error.includes("Timeout");
      return (
        <span className="flex items-center gap-1 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2.5 py-1 rounded-full font-medium">
          <AlertTriangle className="w-3.5 h-3.5" />
          {isTimeout ? 'Timed Out' : 'Failed'}
        </span>
      );
    }

    if (output !== null) {
      return (
        <span className="flex items-center gap-1 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          Success
        </span>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full bg-dark-900 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-dark-950/40">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold tracking-wide text-gray-300">Terminal Output</span>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {executionTime !== null && !loading && (
              <span className="flex items-center gap-1 text-xs bg-white/5 border border-white/10 text-gray-400 px-2.5 py-1 rounded-full">
                <Clock className="w-3 h-3" />
                {executionTime}s
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {((activeTab === 'stdout' && output) || (activeTab === 'stderr' && error)) && (
            <button
              onClick={handleCopy}
              title="Copy Output"
              className="p-1.5 hover:bg-dark-800 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClear}
            title="Clear Terminal"
            disabled={!output && !error}
            className="p-1.5 hover:bg-dark-800 rounded-lg text-gray-400 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Content Panel */}
      <div className="flex-1 flex flex-col min-h-0 bg-dark-950 font-mono text-sm leading-relaxed p-6 overflow-hidden">
        {/* Terminal Tabs */}
        <div className="flex gap-2 border-b border-white/5 pb-3 mb-4">
          <button
            onClick={() => setActiveTab('stdout')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all duration-300 ${
              activeTab === 'stdout'
                ? 'bg-brand-purple/10 text-brand-purple border border-brand-purple/20'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Stdout
          </button>
          <button
            onClick={() => setActiveTab('stderr')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all duration-300 ${
              activeTab === 'stderr'
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Stderr & Errors
          </button>
        </div>

        {/* Terminal Screens */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
              <span className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin"></span>
              <span className="text-xs animate-pulse">Running program on host Docker...</span>
            </div>
          ) : activeTab === 'stdout' ? (
            output ? (
              <pre className="text-emerald-400 whitespace-pre-wrap selection:bg-emerald-800/50">{output}</pre>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-600 italic text-xs">
                No standard output has been captured. Run some code to see output.
              </div>
            )
          ) : (
            error ? (
              <pre className="text-rose-400 whitespace-pre-wrap selection:bg-rose-800/50">{error}</pre>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-600 italic text-xs">
                Clean build. No runtime errors or warnings detected.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
