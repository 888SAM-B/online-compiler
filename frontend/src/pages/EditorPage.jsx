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
  Laptop,
  Loader2,
  Copy,
  CheckCircle,
  AlertCircle,
  FileCode
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
  const monacoRef = useRef(null);
  const inlineCompletionsDisposableRef = useRef(null);

  const [aiSuggestionsEnabled, setAiSuggestionsEnabled] = useState(() => {
    return localStorage.getItem('ai_suggestions_enabled') !== 'false';
  });

  useEffect(() => {
    localStorage.setItem('ai_suggestions_enabled', aiSuggestionsEnabled);
  }, [aiSuggestionsEnabled]);


  // AI assistant state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiFeature, setAiFeature] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState(null);

  const handleAIAction = async (feature) => {
    setAiFeature(feature);
    setAiModalOpen(true);
    setAiResult(null);
    setAiPrompt('');
    
    // Auto trigger for Explain and Debug
    if (feature === 'EXPLAIN') {
      setAiLoading(true);
      try {
        const res = await api.post('/ai/explain', { language, code });
        if (res.data.success) {
          setAiResult(res.data.explanation);
        }
      } catch (err) {
        setToast({ 
          message: err.response?.data?.detail || err.response?.data?.message || 'AI service temporarily unavailable.', 
          type: 'error' 
        });
        setAiModalOpen(false);
      } finally {
        setAiLoading(false);
      }
    } else if (feature === 'DEBUG') {
      setAiLoading(true);
      try {
        const res = await api.post('/ai/debug', { language, code });
        if (res.data.success) {
          setAiResult(res.data.issues);
        }
      } catch (err) {
        setToast({ 
          message: err.response?.data?.detail || err.response?.data?.message || 'AI service temporarily unavailable.', 
          type: 'error' 
        });
        setAiModalOpen(false);
      } finally {
        setAiLoading(false);
      }
    }
  };

  const triggerGenerateCode = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await api.post('/ai/generate', { language, prompt: aiPrompt });
      if (res.data.success) {
        setAiResult(res.data.generated_code);
      }
    } catch (err) {
      setToast({ 
        message: err.response?.data?.detail || err.response?.data?.message || 'AI service temporarily unavailable.', 
        type: 'error' 
      });
    } finally {
      setAiLoading(false);
    }
  };

  const insertGeneratedCode = () => {
    if (!aiResult) return;
    setCode(aiResult);
    setAiModalOpen(false);
    setToast({ message: 'Code inserted successfully', type: 'success' });
  };

  const closeAIModal = () => {
    setAiModalOpen(false);
    setAiFeature(null);
    setAiResult(null);
    setAiPrompt('');
  };

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setToast({ message: 'Copied to clipboard', type: 'success' });
  };

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
    monacoRef.current = monaco;
  };

  // Inline Completions Provider registration
  useEffect(() => {
    if (inlineCompletionsDisposableRef.current) {
      inlineCompletionsDisposableRef.current.dispose();
      inlineCompletionsDisposableRef.current = null;
    }

    if (!editorRef.current || !monacoRef.current || !aiSuggestionsEnabled) {
      return;
    }

    const monaco = monacoRef.current;
    
    // Simple helper to check if cursor is inside comments or open string literals
    const isInsideCommentOrString = (text, lang) => {
      const lines = text.split('\n');
      const currentLine = lines[lines.length - 1];
      const trimmed = currentLine.trim();
      
      // Check comment rules
      if (lang === 'python' && trimmed.startsWith('#')) return true;
      if (['javascript', 'java', 'cpp', 'c'].includes(lang) && (trimmed.startsWith('//') || trimmed.startsWith('/*'))) return true;
      
      // Check string quote balance rules (odd quotes means inside open string literal)
      const doubleQuotes = (currentLine.match(/"/g) || []).length;
      const singleQuotes = (currentLine.match(/'/g) || []).length;
      if (doubleQuotes % 2 !== 0 || singleQuotes % 2 !== 0) return true;
      
      if (lang === 'javascript') {
        const backticks = (currentLine.match(/`/g) || []).length;
        if (backticks % 2 !== 0) return true;
      }
      
      return false;
    };

    const provider = monaco.languages.registerInlineCompletionsProvider(
      getMonacoLanguage(language),
      {
        provideInlineCompletions: async (model, position, context, token) => {
          // 1. Validate total document trigger condition
          const fullText = model.getValue();
          if (fullText.trim().length < 10) {
            return { items: [] };
          }

          // 2. Validate line comments/string trigger conditions
          const offset = model.getOffsetAt(position);
          const precedingText = fullText.substring(0, offset);
          if (isInsideCommentOrString(precedingText, language)) {
            return { items: [] };
          }

          // 3. Debounce: wait 500ms
          try {
            await new Promise((resolve, reject) => {
              const timer = setTimeout(resolve, 500);
              token.onCancellationRequested(() => {
                clearTimeout(timer);
                reject(new Error('cancelled'));
              });
            });
          } catch (e) {
            return { items: [] };
          }

          if (token.isCancellationRequested) {
            return { items: [] };
          }

          // 4. Get optimized 5000 character context around the cursor
          let codeValue = fullText;
          let relativeCursor = offset;
          if (fullText.length > 5000) {
            const start = Math.max(0, offset - 4000);
            const end = Math.min(fullText.length, offset + 1000);
            codeValue = fullText.substring(start, end);
            relativeCursor = offset - start;
          }

          // 5. AbortController to cancel HTTP request on typing continuation
          const controller = new AbortController();
          token.onCancellationRequested(() => {
            controller.abort();
          });

          try {
            const res = await api.post('/ai/suggest', {
              language,
              code: codeValue,
              cursor_position: relativeCursor
            }, { signal: controller.signal });

            if (res.data.success && res.data.suggestion) {
              return {
                items: [
                  {
                    insertText: res.data.suggestion,
                    range: new monaco.Range(
                      position.lineNumber,
                      position.column,
                      position.lineNumber,
                      position.column
                    )
                  }
                ]
              };
            }
          } catch (err) {
            // Silently ignore canceled or connection errors
          }

          return { items: [] };
        },
        freeInlineCompletions: () => {}
      }
    );

    inlineCompletionsDisposableRef.current = provider;

    return () => {
      if (inlineCompletionsDisposableRef.current) {
        inlineCompletionsDisposableRef.current.dispose();
        inlineCompletionsDisposableRef.current = null;
      }
    };
  }, [language, aiSuggestionsEnabled, editorRef.current, monacoRef.current]);


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

          {/* AI Suggestions toggle */}
          <button
            onClick={() => setAiSuggestionsEnabled(!aiSuggestionsEnabled)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/5 hover:bg-white/5 text-xs text-gray-400 transition"
          >
            {aiSuggestionsEnabled ? (
              <>
                <ToggleRight className="w-5 h-5 text-brand-purple" />
                <span>⚡ AI Suggestions: ON</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-5 h-5 text-gray-500" />
                <span>⚡ AI Suggestions: OFF</span>
              </>
            )}
          </button>


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
            <div className="flex items-center gap-3">
              <span className="text-gray-400 capitalize">Source Code Editor</span>
              <span className="text-brand-purple font-mono uppercase font-bold">{language}</span>
            </div>
            
            {/* AI Assistant Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAIAction('EXPLAIN')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-purple/10 hover:bg-brand-purple/20 border border-brand-purple/20 text-brand-purple hover:text-white transition-all text-[10px] font-semibold animate-pulse"
              >
                <Sparkles className="w-3 h-3" />
                Explain Code
              </button>
              <button
                onClick={() => handleAIAction('DEBUG')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-teal/10 hover:bg-brand-teal/20 border border-brand-teal/20 text-brand-teal hover:text-white transition-all text-[10px] font-semibold animate-pulse"
              >
                <Sparkles className="w-3 h-3" />
                Debug Code
              </button>
              <button
                onClick={() => handleAIAction('GENERATE')}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-green/10 hover:bg-brand-green/20 border border-brand-green/20 text-brand-green hover:text-white transition-all text-[10px] font-semibold animate-pulse"
              >
                <Sparkles className="w-3 h-3" />
                Generate Code
              </button>
            </div>
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
                padding: { top: 10, bottom: 10 },
                inlineSuggest: {
                  enabled: true,
                  mode: "subword"
                },
                suggest: {
                  preview: true
                }
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
      {/* AI Assistant Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="glass w-full max-w-2xl max-h-[85vh] flex flex-col p-6 rounded-2xl border border-white/10 shadow-2xl relative animate-fade-in text-left">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
              <div className="flex items-center gap-2 text-brand-purple">
                <Sparkles className="w-5 h-5 animate-pulse" />
                <h3 className="text-lg font-bold text-gray-100">
                  {aiFeature === 'EXPLAIN' && 'AI Code Explainer'}
                  {aiFeature === 'DEBUG' && 'AI Code Debugger'}
                  {aiFeature === 'GENERATE' && 'AI Code Generator'}
                </h3>
              </div>
              <button
                onClick={closeAIModal}
                className="text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition"
              >
                ✕
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1">
              {aiLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-400">
                  <Loader2 className="w-10 h-10 animate-spin text-brand-purple" />
                  <span className="text-sm font-medium">AI is thinking, please wait...</span>
                </div>
              ) : (
                <>
                  {/* FEATURE: EXPLAIN */}
                  {aiFeature === 'EXPLAIN' && (
                    <div className="flex flex-col gap-4">
                      <div className="bg-dark-950/80 border border-white/5 p-4 rounded-xl max-h-[50vh] overflow-y-auto font-mono text-sm leading-relaxed text-gray-300 pre-wrap whitespace-pre-wrap">
                        {aiResult}
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleCopy(aiResult)}
                          className="flex items-center gap-1.5 px-4 py-2 border border-white/5 hover:bg-white/5 rounded-xl text-xs font-semibold text-gray-300 transition"
                        >
                          <Copy className="w-4 h-4 text-brand-purple" />
                          Copy Explanation
                        </button>
                      </div>
                    </div>
                  )}

                  {/* FEATURE: DEBUG */}
                  {aiFeature === 'DEBUG' && (
                    <div className="flex flex-col gap-4">
                      {(!aiResult || aiResult.length === 0) ? (
                        <div className="py-8 flex flex-col items-center justify-center gap-3 text-emerald-400">
                          <CheckCircle className="w-12 h-12 text-center" />
                          <span className="text-sm font-semibold text-center">No issues found! Code looks excellent.</span>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          <p className="text-xs text-gray-400">We identified the following issues in your code:</p>
                          <div className="flex flex-col gap-3.5 max-h-[45vh] overflow-y-auto">
                            {aiResult.map((issue, idx) => (
                              <div key={idx} className="bg-dark-950/60 border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                  <span className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                                    issue.type.toLowerCase().includes('syntax') ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                    issue.type.toLowerCase().includes('security') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                    issue.type.toLowerCase().includes('runtime') ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                                    'bg-brand-teal/10 text-brand-teal border border-brand-teal/20'
                                  }`}>
                                    {issue.type}
                                  </span>
                                  <button
                                    onClick={() => handleCopy(issue.fix)}
                                    title="Copy Fix"
                                    className="p-1.5 hover:bg-dark-800 rounded-lg text-gray-400 hover:text-white transition"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <p className="text-sm text-gray-300 leading-relaxed">{issue.description}</p>
                                {issue.fix && (
                                  <div className="bg-black/40 border border-white/5 p-3 rounded-lg font-mono text-xs text-brand-green overflow-x-auto whitespace-pre">
                                    {issue.fix}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* FEATURE: GENERATE */}
                  {aiFeature === 'GENERATE' && (
                    <div className="flex flex-col gap-4">
                      {!aiResult ? (
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-400">Describe what code you want to generate</label>
                            <textarea
                              rows={4}
                              placeholder="e.g., Write a function to check if a string is a palindrome."
                              value={aiPrompt}
                              onChange={(e) => setAiPrompt(e.target.value)}
                              className="w-full px-4 py-3 rounded-xl bg-dark-950 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple focus:border-brand-purple transition-all"
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={triggerGenerateCode}
                              disabled={!aiPrompt.trim()}
                              className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-brand-purple to-brand-violet hover:opacity-95 rounded-xl text-xs font-bold text-white shadow-lg shadow-brand-purple/20 transition disabled:opacity-50"
                            >
                              Generate Code
                              <Sparkles className="w-4 h-4 animate-pulse" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-4">
                          <div className="bg-dark-950/80 border border-white/5 p-4 rounded-xl max-h-[45vh] overflow-y-auto font-mono text-sm leading-relaxed text-brand-green whitespace-pre overflow-x-auto">
                            {aiResult}
                          </div>
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={() => handleCopy(aiResult)}
                              className="flex items-center gap-1.5 px-4 py-2 border border-white/5 hover:bg-white/5 rounded-xl text-xs font-semibold text-gray-300 transition"
                            >
                              <Copy className="w-4 h-4" />
                              Copy Code
                            </button>
                            <button
                              onClick={insertGeneratedCode}
                              className="flex items-center gap-1.5 px-4 py-2 bg-brand-green hover:bg-brand-green/90 rounded-xl text-xs font-semibold text-white transition shadow-lg shadow-brand-green/20"
                            >
                              <FileCode className="w-4 h-4" />
                              Insert into Editor
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
