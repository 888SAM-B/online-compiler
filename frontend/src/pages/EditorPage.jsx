import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import api from '../api';
import { 
  Play, 
  Save, 
  Download, 
  ChevronLeft, 
  Code, 
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Sun,
  Moon,
  Laptop
} from 'lucide-react';
import Terminal from '../components/Terminal';
import Loader from '../components/Loader';
import Toast from '../components/Toast';

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [program, setProgram] = useState(null);
  
  // Editor State
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [title, setTitle] = useState('Untitled Program');
  const [editorTheme, setEditorTheme] = useState('vs-dark');
  const [autoSave, setAutoSave] = useState(true);
  const [saving, setSaving] = useState(false);

  // Terminal Output State
  const [stdout, setStdout] = useState(null);
  const [stderr, setStderr] = useState(null);
  const [executionTime, setExecutionTime] = useState(null);
  const [running, setRunning] = useState(false);

  const [toast, setToast] = useState(null);
  const editorRef = useRef(null);

  // Fetch program details
  useEffect(() => {
    const fetchProgram = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get(`/programs/${id}`);
        setProgram(res.data);
        setCode(res.data.source_code);
        setLanguage(res.data.language);
        setTitle(res.data.title);
      } catch (err) {
        setToast({ message: 'Failed to load code file', type: 'error' });
        setTimeout(() => navigate('/dashboard'), 2000);
      } finally {
        setLoading(false);
      }
    };
    fetchProgram();
  }, [id, navigate]);

  // Debounced Auto Save
  useEffect(() => {
    if (!autoSave || loading || !id || !program) return;
    
    // Check if code actually changed from original to prevent unnecessary saves
    if (code === program.source_code && title === program.title) return;

    const timer = setTimeout(() => {
      handleSave(true); // Silent save
    }, 2500);

    return () => clearTimeout(timer);
  }, [code, title, autoSave]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
  };

  const handleSave = async (silent = false) => {
    if (!id) return;
    if (!silent) setSaving(true);
    try {
      const res = await api.put(`/programs/${id}`, {
        title,
        language,
        source_code: code
      });
      // Update our baseline reference program to prevent loop triggers
      setProgram(res.data);
      if (!silent) {
        setToast({ message: 'Code saved successfully', type: 'success' });
      }
    } catch (err) {
      if (!silent) {
        setToast({ message: 'Failed to save code', type: 'error' });
      }
    } finally {
      if (!silent) setSaving(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setStdout(null);
    setStderr(null);
    setExecutionTime(null);
    try {
      // Auto save before running
      if (id) {
        await handleSave(true);
      }
      
      const res = await api.post('/execute', {
        code,
        language,
        program_id: id || null
      });

      if (res.data.success) {
        setStdout(res.data.output);
        setStderr(res.data.error || null); // Display warnings if any
      } else {
        setStdout(res.data.output || null);
        setStderr(res.data.error);
      }
      setExecutionTime(res.data.execution_time);
    } catch (err) {
      setStderr(err.response?.data?.detail || 'Execution request failed.');
    } finally {
      setRunning(false);
    }
  };

  const handleDownload = () => {
    let extension = 'txt';
    if (language === 'python') extension = 'py';
    else if (language === 'javascript') extension = 'js';
    else if (language === 'c') extension = 'c';
    else if (language === 'cpp') extension = 'cpp';
    else if (language === 'java') extension = 'java';

    const element = document.createElement('a');
    const file = new Blob([code], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${title.replace(/\s+/g, '_')}.${extension}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setToast({ message: 'Download initiated', type: 'info' });
  };

  const handleClearTerminal = () => {
    setStdout(null);
    setStderr(null);
    setExecutionTime(null);
  };

  if (loading) {
    return <Loader fullScreen={true} />;
  }

  // Map language value to Monaco editor language ids
  const getMonacoLanguage = (lang) => {
    if (lang === 'c' || lang === 'cpp') return 'cpp';
    return lang;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-dark-950 overflow-hidden text-gray-100">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Editor Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-b border-white/5 bg-dark-900/40">
        {/* Back and File details */}
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="p-2 hover:bg-dark-800 rounded-xl border border-white/5 text-gray-400 hover:text-white transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-brand-purple" />
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name your program..."
              className="bg-transparent border-b border-transparent hover:border-white/10 focus:border-brand-purple focus:outline-none font-semibold text-lg text-gray-200 transition-colors px-1"
            />
          </div>
        </div>

        {/* IDE actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Auto save toggle */}
          {id && (
            <button
              onClick={() => setAutoSave(!autoSave)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/5 hover:bg-white/5 text-xs text-gray-400 transition"
            >
              {autoSave ? (
                <>
                  <ToggleRight className="w-5 h-5 text-brand-purple" />
                  <span>Auto-save: ON</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5 text-gray-500" />
                  <span>Auto-save: OFF</span>
                </>
              )}
            </button>
          )}

          {/* Theme switch */}
          <select
            value={editorTheme}
            onChange={(e) => setEditorTheme(e.target.value)}
            className="bg-dark-900 border border-white/5 px-3 py-2 rounded-xl text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-purple"
          >
            <option value="vs-dark">Dark Theme</option>
            <option value="light">Light Theme</option>
          </select>

          {/* Download button */}
          <button
            onClick={handleDownload}
            title="Download Program File"
            className="p-2 hover:bg-dark-800 border border-white/5 rounded-xl text-gray-400 hover:text-white transition"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Manual Save button */}
          {id && (
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 border border-white/5 hover:border-brand-purple/20 bg-dark-900/60 hover:bg-dark-800/80 rounded-xl text-xs font-semibold text-gray-300 disabled:opacity-40 transition"
            >
              <Save className="w-4 h-4 text-brand-purple" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}

          {/* Execute Code button */}
          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 bg-gradient-to-r from-brand-purple to-brand-violet hover:opacity-95 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg shadow-brand-purple/20 transition disabled:opacity-50"
          >
            <Play className="w-4.5 h-4.5" />
            {running ? 'Running...' : 'Run Code'}
          </button>
        </div>
      </div>

      {/* Editor Split Panel */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Editor Workspace */}
        <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-white/5 min-h-[300px] lg:min-h-0">
          <div className="flex items-center justify-between px-6 py-2 border-b border-white/5 bg-dark-950/20 text-xs">
            <span className="text-gray-400 capitalize">Source Code Editor</span>
            <span className="text-brand-purple font-mono uppercase font-bold">{language}</span>
          </div>
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language={getMonacoLanguage(language)}
              value={code}
              theme={editorTheme}
              onMount={handleEditorDidMount}
              onChange={(value) => setCode(value || '')}
              options={{
                fontSize: 14,
                fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
                minimap: { enabled: false },
                lineNumbers: 'on',
                roundedSelection: true,
                scrollBeyondLastLine: false,
                readOnly: false,
                automaticLayout: true,
                padding: { top: 10, bottom: 10 }
              }}
            />
          </div>
        </div>

        {/* Output Panel */}
        <div className="flex-1 lg:max-w-xl flex flex-col p-4 bg-dark-950/40 min-h-[250px] lg:min-h-0">
          <Terminal
            output={stdout}
            error={stderr}
            executionTime={executionTime}
            loading={running}
            onClear={handleClearTerminal}
          />
        </div>
      </div>
    </div>
  );
}
