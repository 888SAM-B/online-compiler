import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  History, 
  Terminal, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Code 
} from 'lucide-react';
import Loader from '../components/Loader';
import Toast from '../components/Toast';

export default function ExecutionHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  
  // State to track which item IDs are expanded
  const [expandedItems, setExpandedItems] = useState({});

  const fetchHistory = async () => {
    try {
      const res = await api.get('/history');
      setHistory(res.data);
    } catch (err) {
      setToast({ message: 'Failed to fetch execution history', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const toggleExpand = (id) => {
    setExpandedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (loading) {
    return <Loader fullScreen={true} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 text-left">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Execution History</h1>
        <p className="text-sm text-gray-400 mt-1">
          Review details, performance, and outputs from your past compilation and execution runs.
        </p>
      </div>

      {history.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[300px] gap-4">
          <History className="w-16 h-16 text-gray-600 animate-pulse" />
          <h3 className="text-lg font-bold text-gray-300">No executions logged</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Load up an editor and run some code snippets to populate your diagnostic logs.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {history.map((item) => {
            const isExpanded = !!expandedItems[item.id];
            const hasError = item.status !== 'success';
            
            return (
              <div
                key={item.id}
                className={`glass rounded-2xl overflow-hidden border transition-all duration-300 ${
                  isExpanded ? 'border-brand-purple/20' : 'border-white/5 hover:border-white/10'
                }`}
              >
                {/* Header Summary */}
                <div
                  onClick={() => toggleExpand(item.id)}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-4">
                    {/* Status Icon */}
                    <div className={`p-2.5 rounded-xl ${
                      hasError 
                        ? 'bg-rose-500/10 text-rose-400' 
                        : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {hasError ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    </div>

                    <div className="flex flex-col gap-0.5 text-left">
                      <span className="font-bold text-gray-200 capitalize flex items-center gap-2">
                        {item.language} Run
                        <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider text-gray-500">
                          {item.status}
                        </span>
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(item.executed_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 text-xs">
                    {/* execution metadata */}
                    <div className="flex items-center gap-4 text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-500" />
                        {item.execution_time}s
                      </span>
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </div>

                {/* Collapsible Details */}
                {isExpanded && (
                  <div className="border-t border-white/5 bg-dark-950/50 p-6 flex flex-col gap-6">
                    {/* Source Code segment */}
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                        <Code className="w-4 h-4 text-brand-purple" />
                        Executed Source Code
                      </span>
                      <pre className="p-4 rounded-xl bg-dark-950 border border-white/5 font-mono text-sm text-gray-300 overflow-x-auto text-left whitespace-pre-wrap max-h-60 selection:bg-brand-purple/20">
                        {item.source_code}
                      </pre>
                    </div>

                    {/* Terminal output segment */}
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
                        <Terminal className="w-4 h-4 text-brand-teal" />
                        Terminal Output
                      </span>
                      {hasError ? (
                        <pre className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/10 font-mono text-sm text-rose-400 overflow-x-auto text-left whitespace-pre-wrap">
                          {item.error || 'Unknown runtime error occurred.'}
                        </pre>
                      ) : (
                        <pre className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/10 font-mono text-sm text-emerald-400 overflow-x-auto text-left whitespace-pre-wrap">
                          {item.output || 'Process executed successfully with no output.'}
                        </pre>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
