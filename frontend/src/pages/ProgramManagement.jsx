import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { 
  Folder, 
  Search, 
  Trash2, 
  Download, 
  ExternalLink, 
  Plus, 
  Code2, 
  Calendar 
} from 'lucide-react';
import Loader from '../components/Loader';
import Toast from '../components/Toast';

export default function ProgramManagement() {
  const navigate = useNavigate();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [newProgram, setNewProgram] = useState({ title: '', language: 'python' });

  const fetchPrograms = async () => {
    try {
      const res = await api.get('/programs');
      setPrograms(res.data);
    } catch (err) {
      setToast({ message: 'Failed to fetch programs list', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newProgram.title.trim()) return;

    try {
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
      setPrograms(programs.filter((p) => p.id !== id));
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

  // Filter programs based on query and language
  const filteredPrograms = programs.filter((prog) => {
    const matchesSearch = prog.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLanguage = selectedLanguage === 'all' || prog.language === selectedLanguage;
    return matchesSearch && matchesLanguage;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 text-left">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Programs</h1>
          <p className="text-sm text-gray-400 mt-1">
            Search, filter, and organize all your saved programming workspaces.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-brand-purple to-brand-violet hover:opacity-95 px-5 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-brand-purple/20 transition-all duration-300 self-start md:self-auto"
        >
          <Plus className="w-4.5 h-4.5" />
          Create Program
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Search input */}
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-3.5 text-gray-500 w-4.5 h-4.5" />
          <input
            type="text"
            placeholder="Search programs by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-dark-900 border border-white/5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple focus:border-brand-purple transition-all"
          />
        </div>

        {/* Language select filter */}
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="bg-dark-900 border border-white/5 px-4 py-3 rounded-xl text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-purple focus:border-brand-purple min-w-[150px] transition-all"
        >
          <option value="all">All Languages</option>
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
          <option value="c">C</option>
          <option value="cpp">C++</option>
          <option value="java">Java</option>
        </select>
      </div>

      {/* Programs grid */}
      {filteredPrograms.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[300px] gap-4">
          <Folder className="w-16 h-16 text-gray-600" />
          <h3 className="text-lg font-bold text-gray-300">No programs found</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            {searchQuery || selectedLanguage !== 'all'
              ? 'Try modifying your search queries or language filters.'
              : 'Create a new project workspace file to start coding.'}
          </p>
          {(searchQuery || selectedLanguage !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedLanguage('all');
              }}
              className="text-brand-purple hover:underline text-sm font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrograms.map((prog) => (
            <div
              key={prog.id}
              className="glass p-6 rounded-2xl flex flex-col justify-between hover:border-brand-purple/20 transition-all duration-300 group glow-border"
            >
              <div className="flex flex-col gap-4 text-left">
                <div className="flex justify-between items-start">
                  <span className="bg-white/5 border border-white/10 px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-gray-400">
                    {prog.language}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleDownload(prog)}
                      title="Download source code"
                      className="p-1.5 hover:bg-dark-800 rounded-lg text-gray-400 hover:text-white transition"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(prog.id, prog.title)}
                      title="Delete workspace"
                      className="p-1.5 hover:bg-rose-500/10 rounded-lg text-gray-400 hover:text-rose-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-lg text-gray-200 group-hover:text-brand-purple transition-colors line-clamp-1">
                    {prog.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Updated {new Date(prog.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="mt-6 border-t border-white/5 pt-4">
                <Link
                  to={`/editor/${prog.id}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-white/5 hover:bg-brand-purple text-sm font-semibold rounded-xl text-gray-300 hover:text-white transition-all duration-300"
                >
                  Open Editor
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

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
