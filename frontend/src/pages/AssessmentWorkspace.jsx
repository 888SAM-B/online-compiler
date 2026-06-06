import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  AlertCircle, 
  Clock, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  Loader2,
  LogOut,
  Send,
  ShieldAlert,
  ShieldCheck,
  Maximize2
} from 'lucide-react';
import api from '../api';
import Loader from '../components/Loader';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

export default function AssessmentWorkspace() {
  const toast = useToast();
  const confirm = useConfirm();
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

  // Secure Mode States
  const [secureModeStarted, setSecureModeStarted] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [isFullscreenActive, setIsFullscreenActive] = useState(true);

  const timerRef = useRef(null);
  const tabViolationCountRef = useRef(0);
  const lastViolationTimeRef = useRef(0);
  const answersRef = useRef({});
  const hasSubmitted = useRef(false);

  // Keep answersRef up to date
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Cleanup on unmount - Auto-submit if not already submitted
  useEffect(() => {
    fetchWorkspace();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Auto submit on leave
      if (!hasSubmitted.current && secureModeStarted) {
        const formattedAnswers = Object.entries(answersRef.current).map(([qId, val]) => ({
          question_id: qId,
          selected_answer: val
        }));
        
        // Use keepalive / sendBeacon style API post
        api.post(`/assessments/attempts/${attemptId}/submit`, {
          answers: formattedAnswers
        }).catch(() => {});

        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
  }, [attemptId, secureModeStarted]);

  // Set up timer countdown when expiresAt changes
  useEffect(() => {
    if (!expiresAt || !secureModeStarted) return;

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
  }, [expiresAt, timeExpired, secureModeStarted]);

  // Secure mode tab-switch check listeners
  useEffect(() => {
    if (!secureModeStarted) return;

    const handleTabViolation = (reason = "Tab switch or window focus loss detected.") => {
      const now = Date.now();
      if (now - lastViolationTimeRef.current < 2000) return; // ignore duplicates
      lastViolationTimeRef.current = now;

      tabViolationCountRef.current += 1;
      setTabSwitches(tabViolationCountRef.current);

      if (tabViolationCountRef.current > 3) {
        triggerSecurityTermination();
      } else {
        toast.warning(`${reason} Warning: ${tabViolationCountRef.current}/3 violations. Test will terminate on the 4th infraction.`);
        // Try to request fullscreen again
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleTabViolation("Tab switch detected.");
      }
    };

    const handleBlur = () => {
      handleTabViolation("Window focus loss detected.");
    };

    const handleFullscreenChange = () => {
      const isFS = !!document.fullscreenElement;
      setIsFullscreenActive(isFS);
      if (!isFS && !hasSubmitted.current) {
        handleTabViolation("Exited fullscreen mode.");
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [secureModeStarted]);

  // Disable right-click & developer hotkeys
  useEffect(() => {
    if (!secureModeStarted) return;

    const preventRightClick = (e) => e.preventDefault();
    const preventShortcuts = (e) => {
      if (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'u' || e.key === 'i' || e.key === 'j')) {
        e.preventDefault();
        toast.warning("Copying, pasting, or inspecting is disabled during secure assessment.");
      }
      if (e.key === 'F12') {
        e.preventDefault();
        toast.warning("Developer tools are disabled.");
      }
    };

    window.addEventListener('contextmenu', preventRightClick);
    window.addEventListener('keydown', preventShortcuts);

    return () => {
      window.removeEventListener('contextmenu', preventRightClick);
      window.removeEventListener('keydown', preventShortcuts);
    };
  }, [secureModeStarted]);

  const fetchWorkspace = async () => {
    setLoading(true);
    setError('');
    try {
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

  const startSecureWorkspace = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setSecureModeStarted(true);
      setIsFullscreenActive(true);
    } catch (err) {
      console.error('Fullscreen request failed:', err);
      // Fallback in case browser blocks fullscreen: still set secure mode started
      setSecureModeStarted(true);
      setIsFullscreenActive(false);
      toast.warning("Assessment loaded, but fullscreen mode was blocked by your browser. Please enable fullscreen.");
    }
  };

  const handleSelectOption = async (questionId, optionValue) => {
    if (timeExpired || isSubmitting) return;

    setAnswers(prev => ({
      ...prev,
      [questionId]: optionValue
    }));

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

  const triggerSecurityTermination = async () => {
    hasSubmitted.current = true;
    setTimeExpired(true);
    setIsSubmitting(true);

    try {
      const formattedAnswers = Object.entries(answersRef.current).map(([qId, val]) => ({
        question_id: qId,
        selected_answer: val
      }));

      await api.post(`/assessments/attempts/${attemptId}/submit`, {
        answers: formattedAnswers
      });
      
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      
      toast.error("Security Violation: Assessment closed due to excessive tab switches.");
      navigate(`/assessments/result/${attemptId}`);
    } catch (err) {
      console.error('Security submission failed:', err);
      navigate('/assessments');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmit = async () => {
    hasSubmitted.current = true;
    setTimeExpired(true);
    setIsSubmitting(true);
    
    try {
      const formattedAnswers = Object.entries(answersRef.current).map(([qId, val]) => ({
        question_id: qId,
        selected_answer: val
      }));

      await api.post(`/assessments/attempts/${attemptId}/submit`, {
        answers: formattedAnswers
      });
      
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

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

    const unansweredCount = questions.length - Object.keys(answers).length;
    const ok = await confirm({
      title: 'Submit Assessment',
      message: unansweredCount > 0 
        ? `You have ${unansweredCount} unanswered questions left. Are you sure you want to finish and submit the assessment now?`
        : 'Are you sure you want to submit your assessment and complete the test?',
      confirmText: 'Submit Assessment',
      cancelText: 'Cancel',
      danger: false
    });

    if (!ok) return;

    hasSubmitted.current = true;
    setIsSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([qId, val]) => ({
        question_id: qId,
        selected_answer: val
      }));

      await api.post(`/assessments/attempts/${attemptId}/submit`, {
        answers: formattedAnswers
      });
      
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      navigate(`/assessments/result/${attemptId}`);
    } catch (err) {
      console.error('Failed to submit assessment:', err);
      toast.error(err.response?.data?.detail || 'Failed to submit assessment. Please try again.');
      hasSubmitted.current = false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExitClick = async () => {
    const ok = await confirm({
      title: 'Exit Assessment',
      message: 'Are you sure you want to exit? Exiting will immediately submit your assessment with your current progress and terminate this attempt. You cannot resume later.',
      confirmText: 'Exit & Submit',
      cancelText: 'Cancel',
      danger: true
    });

    if (ok) {
      hasSubmitted.current = true;
      setIsSubmitting(true);
      try {
        const formattedAnswers = Object.entries(answers).map(([qId, val]) => ({
          question_id: qId,
          selected_answer: val
        }));

        await api.post(`/assessments/attempts/${attemptId}/submit`, {
          answers: formattedAnswers
        });
        
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }

        navigate(`/assessments/result/${attemptId}`);
      } catch (err) {
        console.error('Failed to submit on exit:', err);
        navigate('/assessments');
      } finally {
        setIsSubmitting(false);
      }
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

  // Render Secure Exam mode gateway screen before starting
  if (!secureModeStarted) {
    return (
      <div className="flex-1 flex items-center justify-center bg-dark-950 p-6">
        <div className="max-w-md w-full bg-dark-900 border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-brand-purple/10 text-brand-purple rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white mb-3">Secure Workspace</h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            This assessment will run in a locked fullscreen environment. Switching tabs, minimizing windows, exiting fullscreen, or losing window focus more than <strong className="text-rose-400 font-bold">3 times</strong> will automatically terminate and submit your test. Right-click is disabled.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={startSecureWorkspace}
              className="w-full py-3 bg-brand-purple hover:bg-brand-purple/90 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-brand-purple/20 flex items-center justify-center gap-2"
            >
              <Maximize2 className="w-4 h-4" />
              Enter Fullscreen & Start Exam
            </button>
            <button
              onClick={() => navigate('/assessments')}
              className="w-full py-3 bg-dark-950 border border-white/10 text-gray-400 hover:text-white font-bold rounded-xl text-sm transition-all"
            >
              Cancel & Exit
            </button>
          </div>
        </div>
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
            onClick={handleExitClick}
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

        {/* Violations Status */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            {tabSwitches > 0 ? (
              <span className="flex items-center gap-1 text-rose-400 font-semibold px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                <ShieldAlert className="w-3.5 h-3.5" /> Secure Violations: {tabSwitches}/3
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-400 font-semibold px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <ShieldCheck className="w-3.5 h-3.5" /> Secure Connection Active
              </span>
            )}
          </div>

          {/* Saving Status */}
          <div className="hidden md:flex items-center gap-1.5 text-xs">
            {savingStatus === 'saving' && (
              <span className="flex items-center gap-1 text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
              </span>
            )}
            {savingStatus === 'saved' && (
              <span className="flex items-center gap-1 text-brand-green">
                <CheckCircle className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            {savingStatus === 'error' && (
              <span className="flex items-center gap-1 text-rose-400">
                <AlertCircle className="w-3.5 h-3.5" /> Sync error
              </span>
            )}
          </div>

          {/* Countdown Timer */}
          <div className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-all ${getTimerClasses()}`}>
            <Clock className="w-4 h-4 shrink-0" />
            <span className="text-sm font-mono font-bold">{timeLeftStr}</span>
          </div>
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
          <h2 className="text-xl font-bold text-white mb-2">Timer Expired or Secure Mode Violation</h2>
          <p className="text-gray-400 text-sm max-w-sm text-center">
            Your assessment session is finishing. We are securely submitting your answers and evaluating your results...
          </p>
        </div>
      )}

      {/* Fullscreen Required Modal Overlay */}
      {secureModeStarted && !isFullscreenActive && (
        <div className="fixed inset-0 bg-dark-950/95 backdrop-blur-lg flex flex-col items-center justify-center z-[9999] p-6 text-center">
          <div className="max-w-md w-full bg-dark-900 border border-white/10 rounded-3xl p-8 shadow-2xl">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white mb-3">Fullscreen Required</h2>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              To proceed with your assessment and view the questions, you must remain in fullscreen mode. Exiting fullscreen mode repeatedly triggers security violations.
            </p>
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold px-4 py-3 rounded-xl mb-6 flex items-center justify-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Secure Violations: {tabSwitches}/3
            </div>
            <button
              onClick={async () => {
                try {
                  await document.documentElement.requestFullscreen();
                  setIsFullscreenActive(true);
                } catch (err) {
                  toast.error("Failed to enter fullscreen. Please enable fullscreen manually or check permissions.");
                }
              }}
              className="w-full py-3 bg-brand-purple hover:bg-brand-purple/90 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-brand-purple/20 flex items-center justify-center gap-2"
            >
              <Maximize2 className="w-4 h-4" />
              Re-Enter Fullscreen Mode
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
