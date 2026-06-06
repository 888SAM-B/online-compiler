import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Award, 
  Clock, 
  HelpCircle, 
  Play, 
  Lock, 
  CheckCircle2, 
  AlertCircle, 
  Trophy, 
  FileText,
  Calendar,
  History,
  Info
} from 'lucide-react';
import api from '../api';
import Loader from '../components/Loader';
import { useToast } from '../context/ToastContext';

export default function AssessmentsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [history, setHistory] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [assessmentsRes, historyRes, certsRes] = await Promise.all([
        api.get('/assessments'),
        api.get('/assessments/history'),
        api.get('/assessments/certificates')
      ]);
      setAssessments(assessmentsRes.data);
      setHistory(historyRes.data);
      setCertificates(certsRes.data);
    } catch (err) {
      console.error('Failed to load assessments data:', err);
      setError('Failed to load assessments. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  const getCooldownInfo = (assessmentId, cooldownHours, maxAttempts) => {
    const assessmentAttempts = history.filter(h => h.assessment_title === assessments.find(a => a.id === assessmentId)?.title);
    
    // Check total attempts
    if (assessmentAttempts.length >= maxAttempts) {
      return {
        locked: true,
        reason: 'Maximum attempt limit reached',
        remainingTime: null
      };
    }

    // Check cooldown from latest attempt
    if (assessmentAttempts.length > 0) {
      const latest = assessmentAttempts[0]; // History is sorted by submitted_at desc
      if (latest.submitted_at) {
        let submittedTimeStr = latest.submitted_at;
        if (typeof submittedTimeStr === 'string' && !submittedTimeStr.endsWith('Z') && !submittedTimeStr.includes('+')) {
          submittedTimeStr += 'Z';
        }
        const submittedTime = new Date(submittedTimeStr).getTime();
        const cooldownMs = cooldownHours * 60 * 60 * 1000;
        const now = Date.now();
        const diff = (submittedTime + cooldownMs) - now;
        
        if (diff > 0) {
          const hoursLeft = Math.floor(diff / (60 * 60 * 1000));
          const minsLeft = Math.ceil((diff % (60 * 60 * 1000)) / (60 * 1000));
          return {
            locked: true,
            reason: `Cooldown active: ${hoursLeft}h ${minsLeft}m left`,
            remainingTime: diff
          };
        }
      }
    }

    return { locked: false, reason: null, remainingTime: null };
  };

  const getAssessmentStatus = (assessment) => {
    // Check if passed and has certificate
    const passedCert = certificates.find(c => c.assessment_title === assessment.title);
    if (passedCert) {
      return {
        state: 'passed',
        badge: passedCert.badge,
        certificateId: passedCert.certificate_id
      };
    }

    const attempts = history.filter(h => h.assessment_title === assessment.title);
    if (attempts.length > 0) {
      return {
        state: 'failed',
        attemptsCount: attempts.length
      };
    }

    return {
      state: 'new',
      attemptsCount: 0
    };
  };

  const handleStart = async (assessmentId) => {
    try {
      // Create or resume session via backend POST /api/assessments/{id}/start
      const res = await api.post(`/assessments/${assessmentId}/start`);
      // Start response returns attempt_id. Navigate to workspace with this ID
      navigate(`/assessments/workspace/${res.data.attempt_id}`);
    } catch (err) {
      const message = err.response?.data?.detail || 'Failed to start assessment';
      toast.error(message);
    }
  };

  const filteredAssessments = assessments.filter(a => {
    if (activeTab === 'all') return true;
    if (activeTab === 'language') return a.assessment_type === 'language';
    if (activeTab === 'knowledge') return a.assessment_type === 'custom' || a.assessment_type === 'knowledge' || a.language !== 'all';
    if (activeTab === 'master') return a.assessment_type === 'master';
    return true;
  });

  const getDifficultyColor = (type) => {
    if (type === 'master') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (type === 'custom') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-brand-purple/10 text-brand-purple border-brand-purple/20';
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10 bg-dark-950">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Award className="w-8 h-8 text-brand-purple animate-pulse" />
              Certifications & Assessments
            </h1>
            <p className="text-gray-400 mt-1.5 text-sm">
              Assess your programming and computer science knowledge, unlock industry-grade PDF certificates, and earn achievement badges.
            </p>
          </div>
          {certificates.length > 0 && (
            <button
              onClick={() => navigate('/certificates')}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-purple hover:bg-brand-purple/95 text-white font-bold text-sm shadow-lg shadow-brand-purple/20 hover:shadow-brand-purple/35 transition-all duration-300"
            >
              <Trophy className="w-4 h-4" />
              My Certificates ({certificates.length})
            </button>
          )}
        </div>

        {/* Info Banner */}
        <div className="flex gap-4 bg-brand-purple/10 border border-brand-purple/20 rounded-3xl p-5 text-sm text-gray-300">
          <Info className="w-6 h-6 text-brand-purple shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <h3 className="font-bold text-white">Assessment Rules & Guidelines</h3>
            <ul className="list-disc pl-4 text-gray-400 text-xs flex flex-col gap-1 mt-1">
              <li>Each assessment has a strict backend timer. Once started, closing the window will not pause the timer.</li>
              <li>A single active session lock is enforced. You cannot start multiple assessments simultaneously.</li>
              <li>MCQ answers are auto-saved locally on selection. If the timer expires, your work will be auto-submitted.</li>
              <li>Earn badges based on your performance: <span className="text-amber-400 font-bold">Gold (≥90%)</span>, <span className="text-gray-300 font-bold">Silver (≥75%)</span>, or <span className="text-orange-500 font-bold">Bronze (≥50%)</span>.</li>
            </ul>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/5">
          {[
            { id: 'all', name: 'All Certifications' },
            { id: 'language', name: 'Language Certifications' },
            { id: 'knowledge', name: 'Subject Certifications' },
            { id: 'master', name: 'Master Assessment' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-brand-purple text-white shadow-lg shadow-brand-purple/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-dark-800'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm font-semibold">
            {error}
          </div>
        )}

        {/* Content list */}
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader />
          </div>
        ) : filteredAssessments.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-3xl p-10 bg-dark-950/20">
            <HelpCircle className="w-12 h-12 text-gray-600 mb-3" />
            <h3 className="text-white font-bold text-lg">No Assessments Found</h3>
            <p className="text-gray-500 text-sm mt-1">
              There are no active assessments matching this category at the moment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssessments.map(assessment => {
              const statusInfo = getAssessmentStatus(assessment);
              const cd = getCooldownInfo(assessment.id, assessment.cooldown_hours, assessment.max_attempts);
              const attemptsCount = history.filter(h => h.assessment_title === assessment.title).length;

              return (
                <div
                  key={assessment.id}
                  className={`relative flex flex-col justify-between bg-dark-900/20 border ${
                    statusInfo.state === 'passed' ? 'border-brand-green/20' : 'border-white/5'
                  } rounded-3xl p-6 hover:shadow-xl hover:shadow-brand-purple/5 transition-all duration-300`}
                >
                  {statusInfo.state === 'passed' && (
                    <div className="absolute top-0 right-6 -translate-y-1/2 flex items-center gap-1 text-[10px] text-brand-green font-extrabold uppercase bg-brand-green/10 border border-brand-green/20 px-3 py-1 rounded-full backdrop-blur-md">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Certified
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase border ${getDifficultyColor(assessment.assessment_type)}`}>
                        {assessment.assessment_type === 'master' ? 'Master level' : `${assessment.language} cert`}
                      </span>
                      <span className="text-[11px] text-gray-400 font-bold bg-dark-950 px-2.5 py-1 border border-white/5 rounded-lg">
                        {attemptsCount}/{assessment.max_attempts} Attempts
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white">
                      {assessment.title}
                    </h3>
                    <p className="text-gray-400 text-xs mt-2 leading-relaxed min-h-[48px]">
                      {assessment.description}
                    </p>

                    {/* Stats List */}
                    <div className="grid grid-cols-2 gap-3 mt-5 p-3.5 bg-dark-950/60 border border-white/5 rounded-2xl">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-brand-purple shrink-0" />
                        <div>
                          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Duration</p>
                          <p className="text-xs font-bold text-white">{assessment.duration_minutes} Mins</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-brand-purple shrink-0" />
                        <div>
                          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Questions</p>
                          <p className="text-xs font-bold text-white">{assessment.questions_per_attempt} MCQs</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 col-span-2 border-t border-white/5 pt-2.5 mt-0.5">
                        <Award className="w-4 h-4 text-brand-purple shrink-0" />
                        <div>
                          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Passing Criteria</p>
                          <p className="text-xs font-bold text-white">≥ {assessment.passing_percentage}% Passing Grade</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="mt-6 border-t border-white/5 pt-4 flex flex-col gap-3">
                    {statusInfo.state === 'passed' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/verify-certificate/${statusInfo.certificateId}`)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-dark-950 border border-brand-green/20 hover:bg-dark-900 text-brand-green text-xs font-bold transition-all duration-200"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          View Certificate
                        </button>
                        <a
                          href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/assessments/certificates/${statusInfo.certificateId}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center p-2.5 rounded-xl bg-brand-green/10 border border-brand-green/20 hover:bg-brand-green/20 text-brand-green transition-all"
                          title="Download PDF Certificate"
                        >
                          <FileText className="w-4 h-4" />
                        </a>
                      </div>
                    )}

                    {cd.locked ? (
                      <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold rounded-xl">
                        <Lock className="w-4 h-4 shrink-0" />
                        <span>{cd.reason}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStart(assessment.id)}
                        disabled={attemptsCount >= assessment.max_attempts}
                        className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold transition-all ${
                          attemptsCount >= assessment.max_attempts
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
                            : 'bg-brand-purple hover:bg-brand-purple/95 text-white shadow-md shadow-brand-purple/10'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        {attemptsCount > 0 ? 'Retake Assessment' : 'Start Assessment'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* History / Attempt Logs Section */}
        {history.length > 0 && (
          <div className="mt-8 border-t border-white/5 pt-10">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-6">
              <History className="w-5 h-5 text-gray-400" />
              Recent Attempts History
            </h2>
            <div className="bg-dark-900/10 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-dark-950/40">
                      <th className="p-4 text-xs font-extrabold uppercase tracking-wider text-gray-500">Assessment</th>
                      <th className="p-4 text-xs font-extrabold uppercase tracking-wider text-gray-500">Date Taken</th>
                      <th className="p-4 text-xs font-extrabold uppercase tracking-wider text-gray-500">Score</th>
                      <th className="p-4 text-xs font-extrabold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="p-4 text-xs font-extrabold uppercase tracking-wider text-gray-500">Badge</th>
                      <th className="p-4 text-xs font-extrabold uppercase tracking-wider text-gray-500">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                    {history.slice(0, 10).map((attempt) => (
                      <tr key={attempt.id} className="hover:bg-white/[0.01] transition-all">
                        <td className="p-4 font-bold text-white">{attempt.assessment_title}</td>
                        <td className="p-4 text-xs text-gray-400 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(attempt.submitted_at).toLocaleDateString()} {new Date(attempt.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-4">
                          <span className={`font-mono font-bold ${attempt.passed ? 'text-brand-green' : 'text-rose-400'}`}>
                            {attempt.percentage}%
                          </span>
                          <span className="text-xs text-gray-500 ml-1">({attempt.score} correct)</span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${
                            attempt.passed 
                              ? 'bg-brand-green/10 text-brand-green border border-brand-green/20' 
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {attempt.passed ? 'PASSED' : 'FAILED'}
                          </span>
                        </td>
                        <td className="p-4 text-xs font-bold capitalize">
                          {attempt.badge === 'failed' ? '-' : (
                            <span className={`flex items-center gap-1 ${
                              attempt.badge === 'gold' ? 'text-amber-400' : attempt.badge === 'silver' ? 'text-gray-300' : 'text-orange-500'
                            }`}>
                              <Award className="w-3.5 h-3.5" />
                              {attempt.badge}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-xs text-gray-400 font-mono">
                          {Math.floor(attempt.duration_taken_seconds / 60)}m {attempt.duration_taken_seconds % 60}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
