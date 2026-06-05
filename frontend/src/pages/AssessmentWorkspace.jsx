import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  AlertCircle, 
  Clock, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  Save, 
  Loader2,
  HelpCircle,
  LogOut,
  Send
} from 'lucide-react';
import api from '../api';
import Loader from '../components/Loader';

export default function AssessmentWorkspace() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [assessmentTitle, setAssessmentTitle] = useState('');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // questionId -> selectedOption
  const [activeIndex, setSelectedIndex] = useState(0);
  const [expiresAt, setExpiresAt] = useState(null);
  const [timeLeftStr, setTimeLeftStr] = useState('00:00');
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const [savingStatus, setSavingStatus] = useState('saved'); // 'saving' | 'saved' | 'error'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    fetchWorkspace();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [attemptId]);

  // Set up timer countdown when expiresAt changes
  useEffect(() => {
    if (!expiresAt) return;

    const calculateTimeLeft = () => {
      let expiresAtStr = expiresAt;
      if (typeof expiresAtStr === 'string' && !expiresAtStr.endsWith('Z') && !expiresAtStr.includes('+')) {
        expiresAtStr += 'Z';
      }
      const expirationTime = new Date(expiresAtStr).getTime();
      const now = Date.now();
      const diffSeconds = Math.max(0, Math.floor((expirationTime - now) / 1000));
      
      setSecondsRemaining(diffSeconds);

      if (diffSeconds <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeftStr('00:00');
        if (!timeExpired) {
          handleAutoSubmit();
        }
      } else {
        const mins = Math.floor(diffSeconds / 60);
        const secs = diffSeconds % 60;
        setTimeLeftStr(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };

    calculateTimeLeft(); // Initial run
    timerRef.current = setInterval(calculateTimeLeft, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [expiresAt, timeExpired]);

  const fetchWorkspace = async () => {
    setLoading(true);
    setError('');
    try {
      // Call GET /api/assessments/attempts/{attempt_id}/resume to get attempt details
      const res = await api.get(`/assessments/attempts/${attemptId}/resume`);
      const data = res.data;
      
      setAssessmentTitle(data.assessment_title);
      setQuestions(data.questions);
      setExpiresAt(data.expires_at);

      // Restore answers
      const restoredAnswers = {};
      if (data.answers && Array.isArray(data.answers)) {
        data.answers.forEach(ans => {
          restoredAnswers[ans.question_id] = ans.selected_answer;
        });
      }
      setAnswers(restoredAnswers);
    } catch (err) {
      console.error('Failed to load assessment workspace:', err);
      setError(err.response?.data?.detail || 'Failed to join assessment session. It may have expired or been submitted.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = async (questionId, optionValue) => {
    if (timeExpired || isSubmitting) return;

    // Update local state first
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionValue
    }));

    // Save background progress
    setSavingStatus('saving');
    try {
      await api.post(`/assessments/attempts/${attemptId}/save-answer`, {
        question_id: questionId,
        selected_answer: optionValue
      });
      setSavingStatus('saved');
    } catch (err) {
      console.error('Failed to save answer:', err);
      setSavingStatus('error');
    }
  };

  const handleAutoSubmit = async () => {
    setTimeExpired(true);
    setIsSubmitting(true);
    
    // Automatically submit current answers on timer expiry
    try {
      // Structure answers format for final submission
      const formattedAnswers = Object.entries(answers).map(([qId, val]) => ({
        question_id: qId,
        selected_answer: val
      }));

      await api.post(`/assessments/attempts/${attemptId}/submit`, {
        answers: formattedAnswers
      });
      
      navigate(`/assessments/result/${attemptId}`);
    } catch (err) {
      console.error('Failed to auto-submit:', err);
      setError('Timer expired! Failed to submit your answers automatically. Please contact support.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async () => {
    if (isSubmitting) return;

    // Check unanswered questions
    const unansweredCount = questions.length - Object.keys(answers).length;
    const confirmMessage = unansweredCount > 0 
      ? `You have ${unansweredCount} unanswered questions. Are you sure you want to finish and submit the assessment?`
      : 'Are you sure you want to submit your assessment and complete the test?';

    if (!window.confirm(confirmMessage)) return;

    setIsSubmitting(true);
    try {
      // Structure answers format for final submission
      const formattedAnswers = Object.entries(answers).map(([qId, val]) => ({
        question_id: qId,
        selected_answer: val
      }));

      await api.post(`/assessments/attempts/${attemptId}/submit`, {
        answers: formattedAnswers
      });
      
      navigate(`/assessments/result/${attemptId}`);
    } catch (err) {
      console.error('Failed to submit assessment:', err);
      alert(err.response?.data?.detail || 'Failed to submit assessment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTimerClasses = () => {
    if (secondsRemaining === null) return 'border-white/5 bg-dark-950/40 text-gray-400';
    if (secondsRemaining < 60) {
      return 'border-rose-500/50 bg-rose-500/10 text-rose-400 animate-pulse font-black';
    }
    if (secondsRemaining < 300) {
      return 'border-amber-500/50 bg-amber-500/10 text-amber-400 font-bold';
    }
    return 'border-white/5 bg-dark-950/40 text-brand-purple';
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-dark-950">
        <Loader />
      </div>
    );
  }

  if (error && !timeExpired) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-dark-950 p-6">
        <AlertCircle className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Workspace Error</h2>
        <p className="text-gray-400 text-center max-w-md mb-6">{error}</p>
        <button
          onClick={() => navigate('/assessments')}
          className="px-5 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white font-bold text-sm"
        >
          Back to Assessments
        </button>
      </div>
    );
  }

  const currentQuestion = questions[activeIndex];
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-dark-950 text-gray-100">
      
      {/* Top Header */}
      <header className="h-16 border-b border-white/5 px-6 flex items-center justify-between shrink-0 bg-dark-900/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              if (window.confirm('Are you sure you want to exit the workspace? The countdown timer will continue running in the background.')) {
                navigate('/assessments');
              }
            }}
            className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-all"
            title="Exit Assessment"
          >
            <LogOut className="w-5 h-5 rotate-180" />
          </button>
          <div>
            <h1 className="text-md font-bold text-white max-w-sm md:max-w-md truncate">{assessmentTitle}</h1>
            <p className="text-[10px] text-gray-500 font-medium">Attempt ID: {attemptId}</p>
          </div>
        </div>

        {/* Center Saving Status */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs">
          {savingStatus === 'saving' && (
            <span className="flex items-center gap-1 text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving answer...
            </span>
          )}
          {savingStatus === 'saved' && (
            <span className="flex items-center gap-1 text-brand-green">
              <CheckCircle className="w-3.5 h-3.5" /> All progress saved
            </span>
          )}
          {savingStatus === 'error' && (
            <span className="flex items-center gap-1 text-rose-400">
              <AlertCircle className="w-3.5 h-3.5" /> Connection error, trying again
            </span>
          )}
        </div>

        {/* Countdown Timer */}
        <div className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-all ${getTimerClasses()}`}>
          <Clock className="w-4 h-4 shrink-0" />
          <span className="text-sm font-mono font-bold">{timeLeftStr}</span>
        </div>
      </header>

      {/* Main Workspace Split Pane */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* Left Navigator Sidebar (Table of Questions) */}
        <aside className="w-64 border-r border-white/5 bg-dark-900/10 flex flex-col min-w-[200px] hidden md:flex shrink-0">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-gray-500">Questions List</h3>
            <p className="text-[11px] text-gray-400 mt-1">{answeredCount} of {questions.length} answered</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-4 gap-2.5 content-start">
            {questions.map((q, idx) => {
              const isCurrent = idx === activeIndex;
              const isAnswered = !!answers[q.id];
              
              let btnStyle = 'border-white/5 bg-dark-950 text-gray-400 hover:border-white/20';
              if (isCurrent) {
                btnStyle = 'border-brand-purple bg-brand-purple/10 text-brand-purple font-extrabold shadow-lg shadow-brand-purple/5';
              } else if (isAnswered) {
                btnStyle = 'border-brand-green/20 bg-brand-green/10 text-brand-green font-bold';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setSelectedIndex(idx)}
                  className={`h-10 border rounded-xl text-xs flex items-center justify-center transition-all ${btnStyle}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="p-4 border-t border-white/5 bg-dark-950/20">
            <button
              onClick={handleManualSubmit}
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-brand-purple/15 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Submit Assessment
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Center Main Question View */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto p-6 md:p-10 justify-between">
          <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
            
            {/* Question Label */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-brand-purple font-bold tracking-wider uppercase">
                Question {activeIndex + 1} of {questions.length}
              </span>
              <span className="text-xs text-gray-500 bg-dark-950 px-2 py-0.5 border border-white/5 rounded-md">
                Multiple Choice
              </span>
            </div>

            {/* Question Card */}
            <div className="bg-dark-900/30 border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-md">
              <h2 className="text-base md:text-lg font-bold text-white leading-relaxed select-text whitespace-pre-wrap">
                {currentQuestion?.question_text}
              </h2>
            </div>

            {/* Options List */}
            <div className="flex flex-col gap-3.5">
              {currentQuestion?.options.map((option, optIdx) => {
                const optLetter = String.fromCharCode(65 + optIdx); // A, B, C, D
                const isSelected = answers[currentQuestion.id] === option;
                
                return (
                  <button
                    key={optIdx}
                    onClick={() => handleSelectOption(currentQuestion.id, option)}
                    className={`group w-full flex items-start text-left border rounded-2xl p-4 transition-all duration-200 ${
                      isSelected
                        ? 'bg-brand-purple/10 border-brand-purple text-white shadow-md shadow-brand-purple/5'
                        : 'bg-dark-900/10 border-white/5 hover:border-white/10 hover:bg-dark-900/30 text-gray-300 hover:text-white'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 border mr-4 transition-all ${
                      isSelected
                        ? 'bg-brand-purple border-brand-purple text-white font-extrabold shadow-md'
                        : 'bg-dark-950 border-white/10 text-gray-500 group-hover:border-white/20'
                    }`}>
                      {optLetter}
                    </span>
                    <span className="text-xs md:text-sm font-semibold pt-0.5 leading-relaxed">
                      {option}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation Controls Bar */}
          <div className="max-w-3xl mx-auto w-full mt-10 pt-6 border-t border-white/5 flex items-center justify-between shrink-0">
            <button
              onClick={() => setSelectedIndex(prev => Math.max(0, prev - 1))}
              disabled={activeIndex === 0}
              className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                activeIndex === 0
                  ? 'border-gray-800 text-gray-600 cursor-not-allowed'
                  : 'border-white/5 bg-dark-900/20 hover:bg-dark-900 text-gray-300 hover:text-white'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>

            {/* Mobile Submit Button */}
            <button
              onClick={handleManualSubmit}
              disabled={isSubmitting}
              className="md:hidden flex items-center gap-2 py-2.5 px-4 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white font-bold text-xs transition-all"
            >
              Submit Test
            </button>

            {activeIndex === questions.length - 1 ? (
              <button
                onClick={handleManualSubmit}
                disabled={isSubmitting}
                className="hidden md:flex items-center gap-2 py-2.5 px-6 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white font-bold text-xs shadow-lg shadow-brand-purple/15 transition-all"
              >
                Submit Assessment
              </button>
            ) : (
              <button
                onClick={() => setSelectedIndex(prev => Math.min(questions.length - 1, prev + 1))}
                className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-dark-900/20 border border-white/5 hover:bg-dark-900 text-gray-300 hover:text-white text-xs font-bold transition-all"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </main>
      </div>

      {/* Auto-Submit / Locked Screen Loader Block */}
      {(isSubmitting && timeExpired) && (
        <div className="fixed inset-0 bg-dark-950/90 backdrop-blur-lg flex flex-col items-center justify-center z-50">
          <Loader2 className="w-16 h-16 text-brand-purple animate-spin mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Timer Expired</h2>
          <p className="text-gray-400 text-sm max-w-sm text-center">
            Your time limit has run out. We are securely submitting your answers and evaluating your assessment...
          </p>
        </div>
      )}
    </div>
  );
}
