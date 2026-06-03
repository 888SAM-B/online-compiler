import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { 
  FolderHeart, 
  Code2, 
  Terminal, 
  Plus, 
  Trash2, 
  Download, 
  Clock, 
  Play, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  AlertOctagon
} from 'lucide-react';
import Loader from '../components/Loader';
import Toast from '../components/Toast';

export default function Dashboard() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newProgram, setNewProgram] = useState({ title: '', language: 'python' });

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [progRes, histRes] = await Promise.all([
        api.get('/programs'),
        api.get('/history')
      ]);
      setPrograms(progRes.data);
      setHistory(histRes.data);
    } catch (err) {
      setToast({ message: 'Failed to fetch dashboard data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newProgram.title.trim()) return;

    try {
      // Default starting templates
      let defaultCode = '';
      if (newProgram.language === 'python') {
        defaultCode = 'print("Hello, Python DevSandbox!")\n';
      } else if (newProgram.language === 'javascript') {
        defaultCode = 'console.log("Hello, Node.js DevSandbox!");\n';
      } else if (newProgram.language === 'c') {
        defaultCode = '#include <stdio.h>\n\nint main() {\n    printf("Hello, C DevSandbox!\\n");\n    return 0;\n}\n';
      } else if (newProgram.language === 'cpp') {
        defaultCode = '#include <iostream>\n\nint main() {\n    std::cout << "Hello, C++ DevSandbox!" << std::endl;\n    return 0;\n}\n';
      } else if (newProgram.language === 'java') {
        defaultCode = 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Java DevSandbox!");\n    }\n}\n';
      }

      const res = await api.post('/programs', {
        title: newProgram.title,
        language: newProgram.language,
        source_code: defaultCode
      });
      setModalOpen(false);
      setNewProgram({ title: '', language: 'python' });
      navigate(`/editor/${res.data.id}`);
    } catch (err) {
      setToast({ message: err.response?.data?.detail || 'Failed to create program', type: 'error' });
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      await api.delete(`/programs/${id}`);
      setPrograms(programs.filter(p => p.id !== id));
      setToast({ message: 'Program deleted successfully', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to delete program', type: 'error' });
    }
  };

  const handleDownload = (prog) => {
    let extension = 'txt';
    if (prog.language === 'python') extension = 'py';
    else if (prog.language === 'javascript') extension = 'js';
    else if (prog.language === 'c') extension = 'c';
    else if (prog.language === 'cpp') extension = 'cpp';
    else if (prog.language === 'java') extension = 'java';

    const element = document.createElement('a');
    const file = new Blob([prog.source_code], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${prog.title.replace(/\s+/g, '_')}.${extension}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  if (loading) {
    return <Loader fullScreen={true} />;
  }

  // Aggregate stats
  const totalPrograms = programs.length;
  const totalExecutions = history.length;
  const languagesUsed = programs.reduce((acc, p) => {
    acc[p.language] = (acc[p.language] || 0) + 1;
    return acc;
  }, {});
  const favoriteLanguage = Object.keys(languagesUsed).reduce((a, b) => languagesUsed[a] > languagesUsed[b] ? a : b, 'None');

  return (
    <div className="flex-1 overflow-y-auto p-6 text-left">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Console Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Manage files, review execution analytics, and load sandbox instances.</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-brand-purple to-brand-violet hover:opacity-95 px-5 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-brand-purple/20 transition-all duration-300 self-start md:self-auto"
        >
          <Plus className="w-4.5 h-4.5" />
          New Program
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="glass p-6 rounded-2xl flex items-center gap-5">
          <div className="bg-brand-purple/10 text-brand-purple p-4 rounded-2xl">
            <FolderHeart className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Programs</p>
            <p className="text-2xl font-bold mt-1">{totalPrograms}</p>
          </div>
        </div>
        <div className="glass p-6 rounded-2xl flex items-center gap-5">
          <div className="bg-brand-teal/10 text-brand-teal p-4 rounded-2xl">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Runs</p>
            <p className="text-2xl font-bold mt-1">{totalExecutions}</p>
          </div>
        </div>
        <div className="glass p-6 rounded-2xl flex items-center gap-5">
          <div className="bg-brand-green/10 text-brand-green p-4 rounded-2xl">
            <Code2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Favorite Language</p>
            <p className="text-2xl font-bold mt-1 capitalize">{favoriteLanguage}</p>
          </div>
        </div>
      </div>

      {/* Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Programs Table */}
        <div className="lg:col-span-2 glass p-6 rounded-2xl flex flex-col min-w-0">
          <h2 className="text-lg font-bold mb-4">Saved Programs</h2>
          <div className="flex-1 overflow-x-auto min-h-[250px]">
            {programs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 py-12 gap-3">
                <Code2 className="w-12 h-12 text-gray-600" />
                <p className="text-sm">You haven't created any programs yet.</p>
                <button
                  onClick={() => setModalOpen(true)}
                  className="text-brand-purple hover:underline text-xs font-semibold"
                >
                  Create one now
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-white/5 pb-2 text-xs uppercase font-bold tracking-wider">
                    <th className="text-left pb-3 font-semibold">Title</th>
                    <th className="text-left pb-3 font-semibold">Language</th>
                    <th className="text-left pb-3 font-semibold">Updated</th>
                    <th className="text-right pb-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {programs.slice(0, 10).map((prog) => (
                    <tr key={prog.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 pr-3 font-medium text-gray-200">
                        <Link to={`/editor/${prog.id}`} className="hover:text-brand-purple flex items-center gap-2">
                          {prog.title}
                          <ExternalLink className="w-3 h-3 text-gray-500" />
                        </Link>
                      </td>
                      <td className="py-3.5 pr-3">
                        <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-gray-400">
                          {prog.language}
                        </span>
                      </td>
                      <td className="py-3.5 pr-3 text-xs text-gray-500">
                        {new Date(prog.updated_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 text-right flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDownload(prog)}
                          title="Download"
                          className="p-1.5 hover:bg-dark-800 rounded text-gray-400 hover:text-white transition"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(prog.id, prog.title)}
                          title="Delete"
                          className="p-1.5 hover:bg-rose-500/10 rounded text-gray-400 hover:text-rose-400 transition"
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
          {programs.length > 10 && (
            <Link to="/programs" className="text-xs text-brand-purple hover:underline font-semibold mt-4 flex items-center gap-1 self-start">
              View all programs
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {/* Execution Logs */}
        <div className="glass p-6 rounded-2xl flex flex-col">
          <h2 className="text-lg font-bold mb-4">Recent Executions</h2>
          <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto max-h-[350px]">
            {history.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-600 italic text-xs py-12 gap-2">
                <Clock className="w-10 h-10 text-gray-700" />
                <span>No executions recorded.</span>
              </div>
            ) : (
              history.slice(0, 8).map((hist) => (
                <div key={hist.id} className="bg-dark-950/60 border border-white/5 rounded-xl p-3.5 flex items-center justify-between text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-300 capitalize flex items-center gap-1.5">
                      {hist.status === 'success' ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
                      )}
                      {hist.language}
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(hist.executed_at).toLocaleTimeString()} — {hist.execution_time}s
                    </span>
                  </div>
                  <div className="text-gray-500 font-mono text-[10px]">
                    {hist.status === 'success' ? 'SUCCESS' : 'FAILED'}
                  </div>
                </div>
              ))
            )}
          </div>
          {history.length > 8 && (
            <Link to="/history" className="text-xs text-brand-purple hover:underline font-semibold mt-4 flex items-center gap-1 self-start">
              Full history log
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Creation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="glass w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl relative animate-fade-in text-left">
            <h3 className="text-lg font-bold mb-4">Create New Program</h3>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-400">Program Name</label>
                <input
                  type="text"
                  required
                  placeholder="My First Program"
                  value={newProgram.title}
                  onChange={(e) => setNewProgram({ ...newProgram, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple focus:border-brand-purple transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-400">Language</label>
                <select
                  value={newProgram.language}
                  onChange={(e) => setNewProgram({ ...newProgram, language: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple focus:border-brand-purple transition-all text-gray-300"
                >
                  <option value="python">Python 3.12</option>
                  <option value="javascript">JavaScript (Node 20)</option>
                  <option value="c">C (GCC)</option>
                  <option value="cpp">C++ (G++)</option>
                  <option value="java">Java (OpenJDK 21)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-brand-purple hover:bg-brand-purple/95 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition shadow-lg shadow-brand-purple/20"
                >
                  Initialize Editor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
