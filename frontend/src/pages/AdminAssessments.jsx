import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit, 
  RotateCcw, 
  Download, 
  Upload, 
  BarChart3, 
  BookOpen, 
  HelpCircle, 
  Sparkles, 
  FileText,
  Save,
  X,
  PlusCircle,
  TrendingUp,
  Award,
  Database
} from 'lucide-react';
import api from '../api';
import Loader from '../components/Loader';
import QuestionImportModal from '../components/QuestionImportModal';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

export default function AdminAssessments() {
  const toast = useToast();
  const confirm = useConfirm();
  const [assessments, setAssessments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('assessments'); // 'assessments' | 'analytics' | 'backup'
  
  // Modals / Selected Items
  const [selectedAssess, setSelectedAssess] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [showAssessModal, setShowAssessModal] = useState(false);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Form States
  const [assessForm, setAssessForm] = useState({
    title: '',
    description: '',
    assessment_type: 'language',
    language: 'python',
    duration_minutes: 60,
    questions_per_attempt: 30,
    question_pool_size: 100,
    passing_percentage: 50,
    max_attempts: 3,
    cooldown_hours: 24,
    badge_rules: { gold: 90, silver: 75, bronze: 50 },
    active: true
  });

  const [questionForm, setQuestionForm] = useState({
    question_text: '',
    options: ['', '', '', ''],
    correct_answer: '',
    difficulty: 'easy',
    explanation: '',
    points: 1
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [assessRes, analyticsRes] = await Promise.all([
        api.get('/assessments'),
        api.get('/admin/assessments/analytics')
      ]);
      setAssessments(assessRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error('Failed to load admin assessments:', err);
      setError('Failed to load assessment data. Are you an admin?');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdateAssessment = async (e) => {
    e.preventDefault();
    try {
      if (assessForm.id) {
        // Update
        const res = await api.put(`/admin/assessments/${assessForm.id}`, assessForm);
        setAssessments(prev => prev.map(a => a.id === res.data.id ? res.data : a));
        toast.success('Assessment updated successfully!');
      } else {
        // Create
        const res = await api.post('/admin/assessments', assessForm);
        setAssessments(prev => [...prev, res.data]);
        toast.success('Assessment created successfully!');
      }
      setShowAssessModal(false);
      resetAssessForm();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save assessment');
    }
  };

  const handleDeleteAssessment = async (id, title) => {
    const ok = await confirm({
      title: 'Delete Assessment',
      message: `Are you sure you want to permanently delete "${title}" and all its questions?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/assessments/${id}`);
      setAssessments(prev => prev.filter(a => a.id !== id));
      toast.success(`Assessment "${title}" deleted.`);
    } catch (err) {
      toast.error('Failed to delete assessment');
    }
  };

  const handleRegeneratePool = async (id, title) => {
    const ok = await confirm({
      title: 'Regenerate Question Pool',
      message: `Regenerate question pool for "${title}"? This will increment the pool version and force-terminate all active student sessions.`,
      confirmText: 'Regenerate',
      cancelText: 'Cancel',
      danger: false
    });
    if (!ok) return;
    try {
      const res = await api.post(`/admin/assessments/${id}/regenerate`);
      toast.success(`Pool regenerated! New Version: v${res.data.new_version}`);
      fetchData();
    } catch (err) {
      toast.error('Failed to regenerate pool version');
    }
  };

  const handleManageQuestions = async (assessment) => {
    setSelectedAssess(assessment);
    setLoading(true);
    try {
      // We can export or query the questions.
      // Wait, is there a direct GET questions endpoint for a specific assessment?
      // Let's check: admin_assessment_routes.py has export or we can find questions.
      // Wait! Is there an endpoint to get questions of an assessment?
      // Let's look: `admin_assessment_routes.py` has export which gets ALL questions.
      // Wait, is there a GET /admin/assessments/{id}/questions?
      // Ah! In `admin_assessment_routes.py`, there is NO endpoint for `GET /admin/assessments/{id}/questions`!
      // Wait, let's verify if there is one. We viewed the whole file and only saw:
      // - POST `/admin/assessments`
      // - PUT `/admin/assessments/{id}`
      // - DELETE `/admin/assessments/{id}`
      // - POST `/admin/assessments/{id}/questions`
      // - PUT `/admin/assessments/questions/{q_id}`
      // - DELETE `/admin/assessments/questions/{q_id}`
      // - POST `/admin/assessments/{id}/regenerate`
      // - GET `/admin/assessments/export`
      // - POST `/admin/assessments/import`
      // - GET `/admin/assessments/analytics`
      // So there is NO direct GET endpoint for a single assessment's questions!
      // But wait! We can fetch them by calling the export endpoint `GET /admin/assessments/export` and filtering the `questions` array locally by `assessment_id`!
      // That is incredibly simple and robust. Let's do that!
      const exportRes = await api.get('/admin/assessments/export');
      const filtered = exportRes.data.questions.filter(q => q.assessment_id === assessment.id);
      setQuestions(filtered);
      setShowQuestionsModal(true);
    } catch (err) {
      toast.error('Failed to load questions list');
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (!questionForm.correct_answer || !questionForm.options.includes(questionForm.correct_answer)) {
      toast.warning('Correct answer must match one of the four options!');
      return;
    }

    try {
      if (questionForm.id) {
        // Update Question
        const res = await api.put(`/admin/assessments/questions/${questionForm.id}`, questionForm);
        setQuestions(prev => prev.map(q => q.id === res.data.id ? res.data : q));
        toast.success('Question updated successfully!');
      } else {
        // Create Question
        const res = await api.post(`/admin/assessments/${selectedAssess.id}/questions`, questionForm);
        setQuestions(prev => [...prev, res.data]);
        toast.success('Question added successfully!');
      }
      resetQuestionForm();
    } catch (err) {
      toast.error('Failed to save question');
    }
  };

  const handleDeleteQuestion = async (qId) => {
    const ok = await confirm({
      title: 'Remove Question',
      message: 'Are you sure you want to remove this question from the pool?',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      danger: true
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/assessments/questions/${qId}`);
      setQuestions(prev => prev.filter(q => q.id !== qId));
      toast.success('Question removed from pool.');
    } catch (err) {
      toast.error('Failed to delete question');
    }
  };

  const handleExportJSON = async () => {
    try {
      const res = await api.get('/admin/assessments/export');
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href",     dataStr);
      downloadAnchor.setAttribute("download", `assessments_export_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      toast.error('Failed to export assessments JSON');
    }
  };

  const handleImportJSON = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.onload = async (event) => {
      try {
        const payload = JSON.parse(event.target.result);
        if (!payload.assessments || !payload.questions) {
          toast.error('Invalid JSON file format. Must contain assessments and questions keys.');
          return;
        }

        const res = await api.post('/admin/assessments/import', payload);
        toast.success(`Imported ${res.data.imported_assessments} assessments and ${res.data.imported_questions} questions!`);
        fetchData();
      } catch (err) {
        toast.error('Failed to parse or import JSON. Ensure valid JSON Schema.');
      }
    };
    fileReader.readAsText(file);
  };

  const resetAssessForm = () => {
    setAssessForm({
      title: '',
      description: '',
      assessment_type: 'language',
      language: 'python',
      duration_minutes: 60,
      questions_per_attempt: 30,
      question_pool_size: 100,
      passing_percentage: 50,
      max_attempts: 3,
      cooldown_hours: 24,
      badge_rules: { gold: 90, silver: 75, bronze: 50 },
      active: true
    });
  };

  const resetQuestionForm = () => {
    setQuestionForm({
      question_text: '',
      options: ['', '', '', ''],
      correct_answer: '',
      difficulty: 'easy',
      explanation: '',
      points: 1
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10 bg-dark-950">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Database className="w-8 h-8 text-brand-purple" />
              Assessments Management
            </h1>
            <p className="text-gray-400 mt-1.5 text-sm">
              Configure language exams, configure MCQ question banks, verify diagnostics logs, and restore configurations.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => {
                resetAssessForm();
                setShowAssessModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-purple/95 text-white font-bold text-xs shadow-lg shadow-brand-purple/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              Create Assessment
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 pb-2 border-b border-white/5">
          {[
            { id: 'assessments', name: 'Assessments Pool', icon: <BookOpen className="w-4 h-4" /> },
            { id: 'analytics', name: 'Diagnostics & Metrics', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'backup', name: 'Backup & Restore', icon: <RotateCcw className="w-4 h-4" /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-brand-purple/20 text-brand-purple border border-brand-purple/35'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-dark-800'
              }`}
            >
              {tab.icon}
              {tab.name}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="h-64 flex items-center justify-center">
            <Loader />
          </div>
        )}

        {/* Tab 1: Assessments List */}
        {!loading && activeTab === 'assessments' && (
          <div className="grid grid-cols-1 gap-4">
            {assessments.map(a => (
              <div 
                key={a.id} 
                className="bg-dark-900/20 border border-white/5 rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:border-brand-purple/20 transition-all duration-300"
              >
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{a.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border ${
                      a.active ? 'bg-brand-green/10 border-brand-green/20 text-brand-green' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                      {a.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed">{a.description}</p>
                  
                  {/* Meta tags */}
                  <div className="flex flex-wrap gap-2.5 mt-2">
                    <span className="text-[10px] text-gray-500 font-bold bg-dark-950 px-2 py-0.5 rounded border border-white/5">
                      Type: {a.assessment_type}
                    </span>
                    <span className="text-[10px] text-gray-500 font-bold bg-dark-950 px-2 py-0.5 rounded border border-white/5">
                      Language: {a.language}
                    </span>
                    <span className="text-[10px] text-gray-500 font-bold bg-dark-950 px-2 py-0.5 rounded border border-white/5">
                      Time: {a.duration_minutes}m
                    </span>
                    <span className="text-[10px] text-gray-500 font-bold bg-dark-950 px-2 py-0.5 rounded border border-white/5">
                      Q/Attempt: {a.questions_per_attempt}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center lg:self-center shrink-0">
                  <button
                    onClick={() => handleManageQuestions(a)}
                    className="px-3 py-2 rounded-xl bg-dark-950 border border-white/5 hover:border-white/10 text-gray-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-brand-purple" />
                    Questions
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAssess(a);
                      setShowImportModal(true);
                    }}
                    className="px-3 py-2 rounded-xl bg-dark-950 border border-white/5 hover:border-white/10 text-gray-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-brand-green animate-pulse" />
                    Import Bank
                  </button>
                  <button
                    onClick={() => handleRegeneratePool(a.id, a.title)}
                    className="px-3 py-2 rounded-xl bg-dark-950 border border-white/5 hover:border-white/10 text-gray-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
                    title="Regenerate question pool version. Invalidates current exams."
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
                    Regenerate Pool
                  </button>
                  <button
                    onClick={() => {
                      setAssessForm(a);
                      setShowAssessModal(true);
                    }}
                    className="p-2 rounded-xl bg-dark-950 border border-white/5 hover:bg-dark-900 text-gray-400 hover:text-white transition-all"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteAssessment(a.id, a.title)}
                    className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-400 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Analytics */}
        {!loading && activeTab === 'analytics' && analytics && (
          <div className="flex flex-col gap-6">
            
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              <div className="bg-dark-900/20 border border-white/5 rounded-3xl p-6 flex items-center gap-4">
                <TrendingUp className="w-10 h-10 text-brand-purple shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Attempts</p>
                  <p className="text-2xl font-black text-white mt-1">{analytics.total_attempts}</p>
                </div>
              </div>

              <div className="bg-dark-900/20 border border-white/5 rounded-3xl p-6 flex items-center gap-4">
                <Sparkles className="w-10 h-10 text-brand-green shrink-0 animate-pulse" />
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Pass Rate</p>
                  <p className="text-2xl font-black text-brand-green mt-1">{analytics.pass_rate}%</p>
                </div>
              </div>

              <div className="bg-dark-900/20 border border-white/5 rounded-3xl p-6 flex items-center gap-4">
                <HelpCircle className="w-10 h-10 text-amber-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Average Score</p>
                  <p className="text-2xl font-black text-white mt-1">{analytics.average_score}%</p>
                </div>
              </div>

              <div className="bg-dark-900/20 border border-white/5 rounded-3xl p-6 flex items-center gap-4">
                <FileText className="w-10 h-10 text-brand-purple shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Certificates Issued</p>
                  <p className="text-2xl font-black text-white mt-1">{analytics.certificates_generated}</p>
                </div>
              </div>
            </div>

            {/* Badges breakdown panel */}
            <div className="bg-dark-900/10 border border-white/5 rounded-3xl p-6 backdrop-blur-md">
              <h3 className="text-sm font-extrabold uppercase tracking-widest text-gray-400 flex items-center gap-2 mb-6">
                <Award className="w-4 h-4 text-brand-purple" />
                Certificate Badges Distribution
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                <div className="p-4 border border-white/5 rounded-2xl bg-dark-950/60">
                  <Award className="w-10 h-10 text-amber-400 mx-auto mb-2 drop-shadow-[0_0_8px_rgba(251,191,36,0.2)]" />
                  <p className="text-xs font-bold text-gray-400">Gold Badge (≥90%)</p>
                  <p className="text-xl font-black text-white mt-1">{analytics.gold_badges}</p>
                </div>

                <div className="p-4 border border-white/5 rounded-2xl bg-dark-950/60">
                  <Award className="w-10 h-10 text-gray-300 mx-auto mb-2 drop-shadow-[0_0_8px_rgba(209,213,219,0.2)]" />
                  <p className="text-xs font-bold text-gray-400">Silver Badge (≥75%)</p>
                  <p className="text-xl font-black text-white mt-1">{analytics.silver_badges}</p>
                </div>

                <div className="p-4 border border-white/5 rounded-2xl bg-dark-950/60">
                  <Award className="w-10 h-10 text-orange-500 mx-auto mb-2 drop-shadow-[0_0_8px_rgba(249,115,22,0.2)]" />
                  <p className="text-xs font-bold text-gray-400">Bronze Badge (≥50%)</p>
                  <p className="text-xl font-black text-white mt-1">{analytics.bronze_badges}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Backup / Restore JSON */}
        {!loading && activeTab === 'backup' && (
          <div className="bg-dark-900/10 border border-white/5 rounded-3xl p-8 backdrop-blur-md max-w-2xl">
            <h3 className="text-sm font-extrabold uppercase tracking-widest text-gray-400 mb-2">Import / Export configuration</h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-6">
              Export all seeded certifications templates and MCQ database banks as a single backup file, or upload a previously exported backup file to restore values.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleExportJSON}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-brand-purple hover:bg-brand-purple/95 text-white font-bold text-sm shadow-lg shadow-brand-purple/20 transition-all duration-300"
              >
                <Download className="w-4.5 h-4.5" />
                Export Assessments JSON
              </button>

              <label className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-dark-950 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white font-bold text-sm cursor-pointer transition-all">
                <Upload className="w-4.5 h-4.5 text-brand-green" />
                Import Assessments JSON
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

      </div>

      {/* Assessment Modal (Create/Edit) */}
      {showAssessModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col shadow-2xl">
            
            <header className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
              <h3 className="font-extrabold text-white">{assessForm.id ? 'Edit Assessment' : 'Create Assessment'}</h3>
              <button onClick={() => setShowAssessModal(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all">
                <X className="w-4.5 h-4.5" />
              </button>
            </header>

            <form onSubmit={handleCreateOrUpdateAssessment} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 text-xs font-semibold text-gray-300">
              <div className="flex flex-col gap-1.5">
                <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Title</label>
                <input
                  type="text"
                  required
                  value={assessForm.title}
                  onChange={e => setAssessForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-dark-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-brand-purple/50 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Description</label>
                <textarea
                  required
                  rows={3}
                  value={assessForm.description}
                  onChange={e => setAssessForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-dark-950 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-gray-200 focus:outline-none focus:border-brand-purple/50 transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Assessment Type</label>
                  <select
                    value={assessForm.assessment_type}
                    onChange={e => setAssessForm(prev => ({ ...prev, assessment_type: e.target.value }))}
                    className="w-full bg-dark-950 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-gray-300 focus:outline-none"
                  >
                    <option value="language">Language Certification</option>
                    <option value="master">Master Assessment</option>
                    <option value="custom">Subject Certification</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Language Focus</label>
                  <select
                    value={assessForm.language}
                    onChange={e => setAssessForm(prev => ({ ...prev, language: e.target.value }))}
                    className="w-full bg-dark-950 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-gray-300 focus:outline-none"
                  >
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="c">C</option>
                    <option value="cpp">C++</option>
                    <option value="java">Java</option>
                    <option value="all">All (Master)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Duration (m)</label>
                  <input
                    type="number"
                    required
                    value={assessForm.duration_minutes}
                    onChange={e => setAssessForm(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) }))}
                    className="w-full bg-dark-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-200"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Q / Attempt</label>
                  <input
                    type="number"
                    required
                    value={assessForm.questions_per_attempt}
                    onChange={e => setAssessForm(prev => ({ ...prev, questions_per_attempt: parseInt(e.target.value) }))}
                    className="w-full bg-dark-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-200"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Pass %</label>
                  <input
                    type="number"
                    required
                    value={assessForm.passing_percentage}
                    onChange={e => setAssessForm(prev => ({ ...prev, passing_percentage: parseInt(e.target.value) }))}
                    className="w-full bg-dark-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Max Attempts Limit</label>
                  <input
                    type="number"
                    required
                    value={assessForm.max_attempts}
                    onChange={e => setAssessForm(prev => ({ ...prev, max_attempts: parseInt(e.target.value) }))}
                    className="w-full bg-dark-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-200"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Cooldown Hours</label>
                  <input
                    type="number"
                    required
                    value={assessForm.cooldown_hours}
                    onChange={e => setAssessForm(prev => ({ ...prev, cooldown_hours: parseInt(e.target.value) }))}
                    className="w-full bg-dark-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-200"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="assessActive"
                  checked={assessForm.active}
                  onChange={e => setAssessForm(prev => ({ ...prev, active: e.target.checked }))}
                  className="rounded border-white/5 bg-dark-950 text-brand-purple focus:ring-0 w-4.5 h-4.5 cursor-pointer"
                />
                <label htmlFor="assessActive" className="text-xs text-gray-300 font-bold cursor-pointer">Active and available for students</label>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 shrink-0 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAssessModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-dark-950 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-xl bg-brand-purple hover:bg-brand-purple/95 text-white font-bold"
                >
                  Save Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Questions Modal */}
      {showQuestionsModal && selectedAssess && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-white/10 rounded-3xl w-full max-w-4xl overflow-hidden max-h-[90vh] flex flex-col shadow-2xl">
            
            <header className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-dark-950/20">
              <div>
                <h3 className="font-extrabold text-white">Question Bank: {selectedAssess.title}</h3>
                <p className="text-[10px] text-gray-500 font-semibold mt-0.5">{questions.length} Active Questions in database pool</p>
              </div>
              <button 
                onClick={() => {
                  setShowQuestionsModal(false);
                  resetQuestionForm();
                }} 
                className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </header>

            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              
              {/* Left Side: Create / Edit Question Form */}
              <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-white/5 p-6 overflow-y-auto">
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-brand-purple" />
                  {questionForm.id ? 'Edit Question' : 'Add Question'}
                </h4>

                <form onSubmit={handleAddQuestion} className="flex flex-col gap-4 text-xs font-semibold text-gray-300">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Question Text</label>
                    <textarea
                      required
                      rows={3}
                      value={questionForm.question_text}
                      onChange={e => setQuestionForm(prev => ({ ...prev, question_text: e.target.value }))}
                      className="w-full bg-dark-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-200 resize-none focus:outline-none focus:border-brand-purple/50"
                      placeholder="What is the result of 1 + 1?"
                    />
                  </div>

                  {/* 4 Options inputs */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">MCQ Options</label>
                    {questionForm.options.map((opt, idx) => (
                      <input
                        key={idx}
                        type="text"
                        required
                        placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                        value={opt}
                        onChange={e => {
                          const updatedOpts = [...questionForm.options];
                          updatedOpts[idx] = e.target.value;
                          setQuestionForm(prev => ({ ...prev, options: updatedOpts }));
                        }}
                        className="w-full bg-dark-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-200"
                      />
                    ))}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Correct Answer</label>
                    <select
                      value={questionForm.correct_answer}
                      onChange={e => setQuestionForm(prev => ({ ...prev, correct_answer: e.target.value }))}
                      className="w-full bg-dark-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none"
                    >
                      <option value="">Select option...</option>
                      {questionForm.options.map((opt, idx) => (
                        opt ? <option key={idx} value={opt}>{String.fromCharCode(65 + idx)}: {opt}</option> : null
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Difficulty</label>
                      <select
                        value={questionForm.difficulty}
                        onChange={e => setQuestionForm(prev => ({ ...prev, difficulty: e.target.value }))}
                        className="w-full bg-dark-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-300"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Points</label>
                      <input
                        type="number"
                        required
                        value={questionForm.points}
                        onChange={e => setQuestionForm(prev => ({ ...prev, points: parseInt(e.target.value) }))}
                        className="w-full bg-dark-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-200"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Explanation</label>
                    <textarea
                      rows={2}
                      value={questionForm.explanation}
                      onChange={e => setQuestionForm(prev => ({ ...prev, explanation: e.target.value }))}
                      className="w-full bg-dark-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-200 resize-none"
                      placeholder="Correct because..."
                    />
                  </div>

                  <div className="flex gap-2 mt-2">
                    {questionForm.id && (
                      <button
                        type="button"
                        onClick={resetQuestionForm}
                        className="flex-1 py-2 px-3 rounded-xl bg-dark-950 border border-white/10 text-gray-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex-1 py-2 px-3 rounded-xl bg-brand-purple hover:bg-brand-purple/95 text-white flex items-center justify-center gap-1 shadow-md shadow-brand-purple/15"
                    >
                      <Save className="w-4.5 h-4.5" />
                      Save Question
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Side: Questions list */}
              <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4 bg-dark-950/20">
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-gray-400">Question Pool List</h4>
                
                {questions.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-3xl p-10 bg-dark-950/10">
                    <HelpCircle className="w-12 h-12 text-gray-600 mb-3" />
                    <h5 className="text-white font-bold text-sm">No Questions Seeded</h5>
                    <p className="text-[11px] text-gray-500 mt-1">Add a question using the form to populate the assessment question bank.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {questions.map((q, idx) => (
                      <div 
                        key={q.id}
                        className="p-4 rounded-2xl bg-dark-950/60 border border-white/5 hover:border-brand-purple/10 flex flex-col gap-3"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <p className="text-xs font-bold text-white leading-relaxed">
                            {idx + 1}. {q.question_text}
                          </p>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => setQuestionForm(q)}
                              className="p-1 rounded bg-dark-900 hover:bg-dark-850 text-gray-400 hover:text-white transition-all"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Options display */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-white/[0.03] pt-2">
                          {q.options.map((opt, oIdx) => (
                            <div 
                              key={oIdx}
                              className={`p-2 rounded-lg border ${
                                opt === q.correct_answer 
                                  ? 'bg-brand-green/10 border-brand-green/20 text-brand-green font-bold' 
                                  : 'bg-dark-950/40 border-white/5 text-gray-400'
                              }`}
                            >
                              {String.fromCharCode(65 + oIdx)}. {opt}
                            </div>
                          ))}
                        </div>
                        
                        {q.explanation && (
                          <div className="text-[10px] text-gray-500 italic leading-relaxed">
                            <span className="font-bold text-gray-400">Explanation:</span> {q.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Question Import Modal */}
      {showImportModal && selectedAssess && (
        <QuestionImportModal
          assessment={selectedAssess}
          onClose={() => {
            setShowImportModal(false);
            setSelectedAssess(null);
          }}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
