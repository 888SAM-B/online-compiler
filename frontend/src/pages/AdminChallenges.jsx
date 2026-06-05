import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Download, 
  Upload, 
  PlusCircle, 
  X, 
  ChevronRight, 
  Settings, 
  BookOpen,
  Award,
  AlertCircle
} from 'lucide-react';
import api from '../api';
import Loader from '../components/Loader';
import Toast from '../components/Toast';

const CATEGORIES = ['Arrays', 'Strings', 'Math', 'Loops', 'Functions', 'Recursion', 'Searching', 'Sorting'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const STATUSES = ['draft', 'active', 'archived'];

export default function AdminChallenges() {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  
  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null); // Null if creating
  
  // Challenge Form State
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState('Easy');
  const [category, setCategory] = useState('Arrays');
  const [tagsInput, setTagsInput] = useState('');
  const [statusVal, setStatusVal] = useState('draft');
  const [points, setPoints] = useState(50);
  const [estimatedTime, setEstimatedTime] = useState(15);
  const [problemStatement, setProblemStatement] = useState('');
  const [inputFormat, setInputFormat] = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [constraints, setConstraints] = useState('');
  const [sampleInput, setSampleInput] = useState('');
  const [sampleOutput, setSampleOutput] = useState('');
  
  // Starter Codes state
  const [starterPython, setStarterPython] = useState('');
  const [starterJS, setStarterJS] = useState('');
  const [starterC, setStarterC] = useState('');
  const [starterCPP, setStarterCPP] = useState('');
  const [starterJava, setStarterJava] = useState('');

  // Test cases lists
  const [sampleTestCases, setSampleTestCases] = useState([{ input: '', expected_output: '' }]);
  const [hiddenTestCases, setHiddenTestCases] = useState([{ input: '', expected_output: '' }]);

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/challenges');
      setChallenges(res.data);
    } catch (err) {
      console.error('Failed to load admin challenges:', err);
      setError('Failed to fetch challenges from database.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setTitle('');
    setDifficulty('Easy');
    setCategory('Arrays');
    setTagsInput('');
    setStatusVal('draft');
    setPoints(50);
    setEstimatedTime(15);
    setProblemStatement('');
    setInputFormat('');
    setOutputFormat('');
    setConstraints('');
    setSampleInput('');
    setSampleOutput('');
    
    // Set standard boilerplates
    setStarterPython('# Write solution here\nimport sys\n');
    setStarterJS('// Write solution here\nconst fs = require("fs");\n');
    setStarterC('#include <stdio.h>\nint main() {\n  return 0;\n}\n');
    setStarterCPP('#include <iostream>\nusing namespace std;\nint main() {\n  return 0;\n}\n');
    setStarterJava('import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n  }\n}\n');

    setSampleTestCases([{ input: '', expected_output: '' }]);
    setHiddenTestCases([{ input: '', expected_output: '' }]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = async (id) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/challenges/${id}`);
      const ch = res.data;
      setEditingId(id);
      setTitle(ch.title);
      setDifficulty(ch.difficulty);
      setCategory(ch.category);
      setTagsInput(ch.tags.join(', '));
      setStatusVal(ch.status);
      setPoints(ch.points);
      setEstimatedTime(ch.estimated_time_minutes);
      setProblemStatement(ch.problem_statement);
      setInputFormat(ch.input_format);
      setOutputFormat(ch.output_format);
      setConstraints(ch.constraints);
      setSampleInput(ch.sample_input);
      setSampleOutput(ch.sample_output);
      
      setStarterPython(ch.starter_code.python || '');
      setStarterJS(ch.starter_code.javascript || '');
      setStarterC(ch.starter_code.c || '');
      setStarterCPP(ch.starter_code.cpp || '');
      setStarterJava(ch.starter_code.java || '');

      setSampleTestCases(ch.sample_test_cases.length > 0 ? ch.sample_test_cases : [{ input: '', expected_output: '' }]);
      setHiddenTestCases(ch.hidden_test_cases.length > 0 ? ch.hidden_test_cases : [{ input: '', expected_output: '' }]);
      setIsModalOpen(true);
    } catch (err) {
      console.error('Failed to load challenge for edit:', err);
      setToast({ message: 'Error loading challenge detail.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This will clear all submission history.`)) return;
    try {
      await api.delete(`/admin/challenges/${id}`);
      setToast({ message: 'Challenge deleted successfully.', type: 'success' });
      fetchChallenges();
    } catch (err) {
      console.error('Delete failed:', err);
      setToast({ message: 'Failed to delete challenge.', type: 'error' });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Validate starter code
    const starter_code = {
      python: starterPython,
      javascript: starterJS,
      c: starterC,
      cpp: starterCPP,
      java: starterJava
    };

    // Filter out blank test cases
    const filteredSamples = sampleTestCases.filter(t => t.input.trim() || t.expected_output.trim());
    const filteredHidden = hiddenTestCases.filter(t => t.input.trim() || t.expected_output.trim());

    if (filteredSamples.length === 0 || filteredHidden.length === 0) {
      alert('You must provide at least one sample test case and one hidden test case.');
      return;
    }

    const payload = {
      title,
      difficulty,
      category,
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      problem_statement: problemStatement,
      input_format: inputFormat,
      output_format: outputFormat,
      constraints,
      sample_input: sampleInput,
      sample_output: sampleOutput,
      estimated_time_minutes: parseInt(estimatedTime),
      supported_languages: ['python', 'javascript', 'c', 'cpp', 'java'],
      starter_code,
      sample_test_cases: filteredSamples,
      hidden_test_cases: filteredHidden,
      points: parseInt(points),
      status: statusVal
    };

    try {
      if (editingId) {
        await api.put(`/admin/challenges/${editingId}`, payload);
        setToast({ message: 'Challenge updated successfully.', type: 'success' });
      } else {
        await api.post('/admin/challenges', payload);
        setToast({ message: 'Challenge created successfully.', type: 'success' });
      }
      setIsModalOpen(false);
      fetchChallenges();
    } catch (err) {
      console.error('Save challenge error:', err);
      setToast({ message: 'Failed to save coding challenge.', type: 'error' });
    }
  };

  // Import JSON file
  const handleImportClick = () => {
    fileInputRef.current.click();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const challengesList = JSON.parse(event.target.result);
        await api.post('/admin/challenges/import', challengesList);
        setToast({ message: 'Challenges bulk imported successfully!', type: 'success' });
        fetchChallenges();
      } catch (err) {
        console.error('Import failed:', err);
        setToast({ message: 'Invalid JSON challenge list format.', type: 'error' });
      }
    };
    reader.readAsText(file);
    e.target.value = null; // Reset input
  };

  // Export JSON
  const handleExportAll = async () => {
    try {
      const res = await api.get('/admin/challenges/export/all');
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `compiler_challenges_export_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setToast({ message: 'Exported challenges successfully!', type: 'success' });
    } catch (err) {
      console.error('Export failed:', err);
      setToast({ message: 'Failed to export challenges.', type: 'error' });
    }
  };

  // Test cases add/remove helper
  const addTestCase = (type) => {
    if (type === 'sample') {
      setSampleTestCases(prev => [...prev, { input: '', expected_output: '' }]);
    } else {
      setHiddenTestCases(prev => [...prev, { input: '', expected_output: '' }]);
    }
  };

  const removeTestCase = (type, index) => {
    if (type === 'sample') {
      if (sampleTestCases.length <= 1) return;
      setSampleTestCases(prev => prev.filter((_, idx) => idx !== index));
    } else {
      if (hiddenTestCases.length <= 1) return;
      setHiddenTestCases(prev => prev.filter((_, idx) => idx !== index));
    }
  };

  const updateTestCase = (type, index, field, value) => {
    if (type === 'sample') {
      const updated = [...sampleTestCases];
      updated[index][field] = value;
      setSampleTestCases(updated);
    } else {
      const updated = [...hiddenTestCases];
      updated[index][field] = value;
      setHiddenTestCases(updated);
    }
  };

  const filteredChallenges = challenges.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Settings className="w-8 h-8 text-brand-purple" />
              Manage Challenges
            </h1>
            <p className="text-gray-400 mt-1.5 text-sm">
              Create and manage coding challenges, edit boilerplates, hidden test cases, and status configurations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportFile} 
              accept=".json"
              className="hidden" 
            />
            <button
              onClick={handleImportClick}
              className="px-4 py-2.5 bg-dark-950 border border-white/5 hover:bg-dark-800 rounded-xl text-xs font-bold text-gray-300 flex items-center gap-1.5 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              Import JSON
            </button>
            <button
              onClick={handleExportAll}
              className="px-4 py-2.5 bg-dark-950 border border-white/5 hover:bg-dark-800 rounded-xl text-xs font-bold text-gray-300 flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2.5 bg-brand-purple hover:bg-brand-purple/90 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Challenge
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search challenges by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-dark-900/30 border border-white/5 rounded-2xl pl-10 pr-4 py-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-purple/50"
          />
        </div>

        {/* Content Board */}
        {loading ? (
          <div className="h-64 flex items-center justify-center"><Loader /></div>
        ) : filteredChallenges.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-3xl p-10 bg-dark-950/20">
            <BookOpen className="w-12 h-12 text-gray-600 mb-3" />
            <h3 className="text-white font-bold text-lg">No Challenges Found</h3>
          </div>
        ) : (
          <div className="border border-white/5 rounded-3xl overflow-hidden bg-dark-900/10">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/5 bg-dark-900/30 font-bold text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-4">Title</th>
                  <th className="px-6 py-4">Topic</th>
                  <th className="px-6 py-4">Difficulty</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Score</th>
                  <th className="px-6 py-4">Ver.</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredChallenges.map(c => (
                  <tr key={c.id} className="hover:bg-dark-900/20 transition-all">
                    <td className="px-6 py-4.5 font-bold text-white">{c.title}</td>
                    <td className="px-6 py-4.5 text-gray-400 font-semibold">{c.category}</td>
                    <td className="px-6 py-4.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        c.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-400' :
                        c.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {c.difficulty}
                      </span>
                    </td>
                    <td className="px-6 py-4.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        c.status === 'active' ? 'bg-brand-green/10 text-brand-green' :
                        c.status === 'draft' ? 'bg-brand-purple/10 text-brand-purple' : 'bg-gray-500/10 text-gray-400'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-gray-300 font-bold">{c.points} pts</td>
                    <td className="px-6 py-4.5 text-gray-500 font-bold">v{c.version}</td>
                    <td className="px-6 py-4.5 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(c.id)}
                        className="p-2 bg-dark-950 border border-white/5 text-gray-400 hover:text-white rounded-lg transition-all"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.title)}
                        className="p-2 bg-dark-950 border border-white/5 text-gray-400 hover:text-rose-500 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Challenge Drawer Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-4xl bg-dark-900 border border-white/5 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-dark-900/50">
              <h3 className="text-lg font-black text-white">{editingId ? 'Edit Challenge' : 'Create Challenge'}</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-dark-800 text-gray-400 hover:text-white rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6 text-sm text-gray-300">
              {/* Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-dark-950 border border-white/5 rounded-xl px-4 py-2.5 text-gray-200 focus:outline-none focus:border-brand-purple/50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="bg-dark-950 border border-white/5 rounded-xl px-4 py-2.5 text-gray-200 focus:outline-none"
                  >
                    {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Topic</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="bg-dark-950 border border-white/5 rounded-xl px-4 py-2.5 text-gray-200 focus:outline-none"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Points</label>
                  <input
                    type="number"
                    required
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    className="bg-dark-950 border border-white/5 rounded-xl px-4 py-2.5 text-gray-200"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Est. Minutes</label>
                  <input
                    type="number"
                    required
                    value={estimatedTime}
                    onChange={(e) => setEstimatedTime(e.target.value)}
                    className="bg-dark-950 border border-white/5 rounded-xl px-4 py-2.5 text-gray-200"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</label>
                  <select
                    value={statusVal}
                    onChange={(e) => setStatusVal(e.target.value)}
                    className="bg-dark-950 border border-white/5 rounded-xl px-4 py-2.5 text-gray-200 focus:outline-none"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5 col-span-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tags (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="math, strings"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="bg-dark-950 border border-white/5 rounded-xl px-4 py-2.5 text-gray-200"
                  />
                </div>
              </div>

              {/* Description boxes */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Problem Statement</label>
                  <textarea
                    rows="4"
                    required
                    value={problemStatement}
                    onChange={(e) => setProblemStatement(e.target.value)}
                    className="bg-dark-950 border border-white/5 rounded-xl p-4 font-medium"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Input Format</label>
                    <textarea
                      rows="2"
                      required
                      value={inputFormat}
                      onChange={(e) => setInputFormat(e.target.value)}
                      className="bg-dark-950 border border-white/5 rounded-xl p-3"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Output Format</label>
                    <textarea
                      rows="2"
                      required
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="bg-dark-950 border border-white/5 rounded-xl p-3"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Constraints</label>
                    <textarea
                      rows="2"
                      required
                      value={constraints}
                      onChange={(e) => setConstraints(e.target.value)}
                      className="bg-dark-950 border border-white/5 rounded-xl p-3"
                    />
                  </div>
                </div>
              </div>

              {/* Sample codes */}
              <div>
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">Language Starter Boilerplates</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase text-brand-purple">Python</label>
                    <textarea
                      rows="3"
                      value={starterPython}
                      onChange={(e) => setStarterPython(e.target.value)}
                      className="font-mono text-xs bg-dark-950 border border-white/5 rounded-xl p-3"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase text-brand-purple">JavaScript</label>
                    <textarea
                      rows="3"
                      value={starterJS}
                      onChange={(e) => setStarterJS(e.target.value)}
                      className="font-mono text-xs bg-dark-950 border border-white/5 rounded-xl p-3"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase text-brand-purple">C</label>
                    <textarea
                      rows="3"
                      value={starterC}
                      onChange={(e) => setStarterC(e.target.value)}
                      className="font-mono text-xs bg-dark-950 border border-white/5 rounded-xl p-3"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase text-brand-purple">C++</label>
                    <textarea
                      rows="3"
                      value={starterCPP}
                      onChange={(e) => setStarterCPP(e.target.value)}
                      className="font-mono text-xs bg-dark-950 border border-white/5 rounded-xl p-3"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase text-brand-purple">Java</label>
                    <textarea
                      rows="3"
                      value={starterJava}
                      onChange={(e) => setStarterJava(e.target.value)}
                      className="font-mono text-xs bg-dark-950 border border-white/5 rounded-xl p-3 col-span-1 md:col-span-2"
                    />
                  </div>
                </div>
              </div>

              {/* Sample public case outputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sample Stdin Input</label>
                  <textarea
                    rows="2"
                    value={sampleInput}
                    onChange={(e) => setSampleInput(e.target.value)}
                    className="font-mono text-xs bg-dark-950 border border-white/5 rounded-xl p-3"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sample Stdout Output</label>
                  <textarea
                    rows="2"
                    value={sampleOutput}
                    onChange={(e) => setSampleOutput(e.target.value)}
                    className="font-mono text-xs bg-dark-950 border border-white/5 rounded-xl p-3"
                  />
                </div>
              </div>

              {/* Sample Test cases edit list */}
              <div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Public Sample Test Cases</h4>
                  <button
                    type="button"
                    onClick={() => addTestCase('sample')}
                    className="text-xs font-bold text-brand-purple flex items-center gap-1 hover:text-brand-purple/80"
                  >
                    <PlusCircle className="w-4 h-4" /> Add Case
                  </button>
                </div>
                <div className="flex flex-col gap-3.5">
                  {sampleTestCases.map((tc, idx) => (
                    <div key={idx} className="flex gap-4 items-center">
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <input
                          type="text"
                          placeholder="Input"
                          required
                          value={tc.input}
                          onChange={(e) => updateTestCase('sample', idx, 'input', e.target.value)}
                          className="bg-dark-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Expected Output"
                          required
                          value={tc.expected_output}
                          onChange={(e) => updateTestCase('sample', idx, 'expected_output', e.target.value)}
                          className="bg-dark-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTestCase('sample', idx)}
                        className="p-1.5 text-gray-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"
                      >
                        <X className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hidden Test cases edit list */}
              <div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Hidden Test Cases (For submit scoring)</h4>
                  <button
                    type="button"
                    onClick={() => addTestCase('hidden')}
                    className="text-xs font-bold text-brand-purple flex items-center gap-1 hover:text-brand-purple/80"
                  >
                    <PlusCircle className="w-4 h-4" /> Add Case
                  </button>
                </div>
                <div className="flex flex-col gap-3.5">
                  {hiddenTestCases.map((tc, idx) => (
                    <div key={idx} className="flex gap-4 items-center">
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <input
                          type="text"
                          placeholder="Input"
                          required
                          value={tc.input}
                          onChange={(e) => updateTestCase('hidden', idx, 'input', e.target.value)}
                          className="bg-dark-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono"
                        />
                        <input
                          type="text"
                          placeholder="Expected Output"
                          required
                          value={tc.expected_output}
                          onChange={(e) => updateTestCase('hidden', idx, 'expected_output', e.target.value)}
                          className="bg-dark-950 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTestCase('hidden', idx)}
                        className="p-1.5 text-gray-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"
                      >
                        <X className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal footer controls */}
              <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-5 mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-dark-950 border border-white/5 rounded-2xl text-xs font-bold hover:bg-dark-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-brand-purple text-white hover:bg-brand-purple/90 rounded-2xl text-xs font-bold"
                >
                  Save
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
}
