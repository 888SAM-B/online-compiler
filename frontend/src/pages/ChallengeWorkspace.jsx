import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { 
  Play, 
  Send, 
  ChevronLeft, 
  Clock, 
  Award, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  HelpCircle,
  Code,
  Terminal,
  Trophy
} from 'lucide-react';
import api from '../api';
import Loader from '../components/Loader';
import Toast from '../components/Toast';

export default function ChallengeWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState(null);
  
  // Workspace state
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [userCodes, setUserCodes] = useState({}); // Stores user edits per language

  // Run/Submit Action States
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('problem'); // problem | results
  const [toast, setToast] = useState(null);

  // Results State
  const [resultType, setResultType] = useState(null); // 'run' | 'submit'
  const [runResults, setRunResults] = useState(null);
  const [submitResults, setSubmitResults] = useState(null);

  // Achievements Unlocked Modal
  const [newAchievements, setNewAchievements] = useState([]);
  const [showAchievementsModal, setShowAchievementsModal] = useState(false);

  useEffect(() => {
    fetchChallenge();
  }, [id]);

  const fetchChallenge = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/challenges/${id}`);
      setChallenge(res.data);
      
      // Select first supported language
      const defaultLang = res.data.supported_languages[0] || 'python';
      setLanguage(defaultLang);
      
      // Load starter code
      const initialCodes = {};
      res.data.supported_languages.forEach(lang => {
        initialCodes[lang] = res.data.starter_code[lang] || '';
      });
      setUserCodes(initialCodes);
      setCode(initialCodes[defaultLang]);
    } catch (err) {
      console.error('Failed to load challenge:', err);
      setToast({ message: 'Error loading coding challenge details.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleLanguageChange = (newLang) => {
    // Save current code
    setUserCodes(prev => ({ ...prev, [language]: code }));
    // Change language
    setLanguage(newLang);
    // Load new code
    setCode(userCodes[newLang] || challenge.starter_code[newLang] || '');
  };

  const handleRunCode = async () => {
    if (running || submitting) return;
    setRunning(true);
    setResultType('run');
    setRunResults(null);
    setActiveTab('results');
    setToast(null);
    
    try {
      const res = await api.post(`/challenges/${id}/run`, {
        language,
        source_code: code
      });
      setRunResults(res.data);
    } catch (err) {
      console.error('Run code error:', err);
      setToast({ 
        message: err.response?.data?.detail || err.response?.data?.message || 'Execution failed.', 
        type: 'error' 
      });
    } finally {
      setRunning(false);
    }
  };

  const handleSubmitSolution = async () => {
    if (running || submitting) return;
    setSubmitting(true);
    setResultType('submit');
    setSubmitResults(null);
    setActiveTab('results');
    setToast(null);

    // Save previous achievements list to detect additions
    let oldAchievements = [];
    try {
      const progressRes = await api.get('/challenges/progress');
      oldAchievements = progressRes.data.achievements.map(a => a.achievement_type);
    } catch (err) {
      console.error('Error fetching progress:', err);
    }

    try {
      const res = await api.post(`/challenges/${id}/submit`, {
        language,
        source_code: code
      });
      setSubmitResults(res.data);

      if (res.data.passed) {
        setToast({ message: 'Congratulations! All test cases passed.', type: 'success' });
      } else {
        setToast({ message: 'Some test cases failed. Keep debugging!', type: 'error' });
      }

      // Query achievements again to see if new ones were unlocked
      const newProgressRes = await api.get('/challenges/progress');
      const newAchievementsList = newProgressRes.data.achievements.map(a => a.achievement_type);
      const unlocked = newAchievementsList.filter(a => !oldAchievements.includes(a));
      
      if (unlocked.length > 0) {
        setNewAchievements(unlocked);
        setShowAchievementsModal(true);
      }
    } catch (err) {
      console.error('Submit solution error:', err);
      setToast({ 
        message: err.response?.data?.detail || err.response?.data?.message || 'Submission failed.', 
        type: 'error' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loader fullScreen={true} />;
  }

  if (!challenge) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-2" />
        <p className="font-bold text-lg">Challenge not found</p>
        <button onClick={() => navigate('/challenges')} className="mt-4 px-4 py-2 bg-brand-purple rounded-xl text-white text-xs font-bold">
          Back to Challenges
        </button>
      </div>
    );
  }

  const getDifficultyColor = (diff) => {
    switch (diff) {
      case 'Easy': return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
      case 'Medium': return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
      case 'Hard': return 'text-rose-400 border-rose-500/20 bg-rose-500/10';
      default: return 'text-gray-400 border-gray-500/20 bg-gray-500/10';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full bg-dark-950">
      {/* Top Header Panel */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-dark-900/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/challenges')}
            className="p-2 bg-dark-950/40 border border-white/5 rounded-xl text-gray-400 hover:text-white hover:bg-dark-800 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">{challenge.title}</h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${getDifficultyColor(challenge.difficulty)}`}>
                {challenge.difficulty}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500 mt-0.5 font-medium">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Est. Time: {challenge.estimated_time_minutes}m
              </span>
              <span className="flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-brand-purple" />
                Score: {challenge.points} pts
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Language:</span>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="bg-dark-950 border border-white/5 text-gray-200 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-brand-purple/50 cursor-pointer"
            >
              {challenge.supported_languages.map(lang => (
                <option key={lang} value={lang}>
                  {lang === 'cpp' ? 'C++' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Workspace Workspace Splits */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        
        {/* Left Side: Challenge Spec & Description */}
        <div className="w-full lg:w-1/2 flex flex-col overflow-y-auto border-r border-white/5 bg-dark-950/20 px-6 py-6 md:px-8">
          <div className="flex items-center gap-2 border-b border-white/5 pb-4 mb-6">
            <button 
              onClick={() => setActiveTab('problem')}
              className={`pb-2 px-1 text-sm font-bold uppercase tracking-wider border-b-2 transition-all ${
                activeTab === 'problem' 
                  ? 'border-brand-purple text-brand-purple' 
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Problem
            </button>
            <button 
              onClick={() => setActiveTab('results')}
              className={`pb-2 px-1 text-sm font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'results' 
                  ? 'border-brand-purple text-brand-purple' 
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Results
              {(runResults || submitResults) && (
                <span className={`w-2 h-2 rounded-full ${
                  (runResults?.success || submitResults?.passed) ? 'bg-brand-green' : 'bg-rose-500'
                }`} />
              )}
            </button>
          </div>

          {activeTab === 'problem' ? (
            <div className="flex flex-col gap-6 text-gray-300">
              
              {/* Problem statement */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Problem Statement</h3>
                <div className="bg-dark-900/30 border border-white/5 rounded-2xl p-5 text-sm leading-relaxed text-gray-300 whitespace-pre-line font-medium">
                  {challenge.problem_statement}
                </div>
              </div>

              {/* Input format */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Input Format</h3>
                <p className="text-sm text-gray-400 leading-relaxed pl-1">
                  {challenge.input_format}
                </p>
              </div>

              {/* Output format */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Output Format</h3>
                <p className="text-sm text-gray-400 leading-relaxed pl-1">
                  {challenge.output_format}
                </p>
              </div>

              {/* Constraints */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Constraints</h3>
                <div className="bg-dark-900/30 border border-white/5 rounded-xl px-4 py-2.5 font-mono text-xs text-brand-purple/80 inline-block">
                  {challenge.constraints}
                </div>
              </div>

              {/* Sample cases */}
              <div className="flex flex-col gap-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sample Cases</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">Sample Input</span>
                    <pre className="bg-dark-950 border border-white/5 rounded-2xl p-4 font-mono text-xs text-gray-300 overflow-x-auto">
                      {challenge.sample_input}
                    </pre>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider pl-1">Expected Output</span>
                    <pre className="bg-dark-950 border border-white/5 rounded-2xl p-4 font-mono text-xs text-gray-300 overflow-x-auto">
                      {challenge.sample_output}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 h-full">
              {!resultType ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-gray-500 border border-dashed border-white/5 rounded-3xl bg-dark-950/20">
                  <Terminal className="w-12 h-12 text-gray-700 mb-3" />
                  <p className="text-sm font-semibold">No Results Ready</p>
                  <p className="text-xs text-gray-600 mt-1 max-w-xs text-center">
                    Type your solution and click either "Run Code" or "Submit Solution" to trigger verification.
                  </p>
                </div>
              ) : resultType === 'run' ? (
                // Run Results View
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="font-black text-white text-md">Sample Test Run</h3>
                    {running ? (
                      <span className="text-xs text-brand-purple font-bold flex items-center gap-1.5">
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                        Running...
                      </span>
                    ) : runResults?.success ? (
                      <span className="flex items-center gap-1 text-xs text-brand-green font-bold bg-brand-green/10 border border-brand-green/20 px-2 py-0.5 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        All Samples Passed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-lg">
                        <XCircle className="w-3.5 h-3.5" />
                        Failed Samples
                      </span>
                    )}
                  </div>

                  {running && <div className="py-20 flex justify-center"><Loader /></div>}

                  {!running && runResults && (
                    <div className="flex flex-col gap-4">
                      {runResults.results.map((res, idx) => (
                        <div key={idx} className="bg-dark-900/30 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-300">Sample Case #{idx + 1}</span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                              res.passed ? 'bg-brand-green/10 text-brand-green' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              {res.passed ? 'Passed' : 'Failed'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-gray-400">
                            <div>
                              <p className="text-[10px] font-bold uppercase text-gray-600 mb-1">Input</p>
                              <pre className="bg-dark-950 p-2 rounded-lg border border-white/5 max-h-24 overflow-y-auto">{res.input}</pre>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase text-gray-600 mb-1">Expected</p>
                              <pre className="bg-dark-950 p-2 rounded-lg border border-white/5 max-h-24 overflow-y-auto text-emerald-400">{res.expected_output}</pre>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase text-gray-600 mb-1">Actual</p>
                              <pre className={`bg-dark-950 p-2 rounded-lg border border-white/5 max-h-24 overflow-y-auto ${res.passed ? 'text-emerald-400' : 'text-rose-400'}`}>{res.actual_output || res.error || 'No Output'}</pre>
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider text-right">Time: {Math.round(res.execution_time_ms)}ms</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // Submit Results View
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="font-black text-white text-md">Final Submission</h3>
                    {submitting ? (
                      <span className="text-xs text-brand-purple font-bold flex items-center gap-1.5">
                        <Loader className="w-3.5 h-3.5 animate-spin" />
                        Submitting...
                      </span>
                    ) : submitResults?.passed ? (
                      <span className="flex items-center gap-1 text-xs text-brand-green font-bold bg-brand-green/10 border border-brand-green/20 px-2 py-0.5 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Passed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-lg">
                        <XCircle className="w-3.5 h-3.5" />
                        Failed
                      </span>
                    )}
                  </div>

                  {submitting && <div className="py-20 flex justify-center"><Loader /></div>}

                  {!submitting && submitResults && (
                    <div className="flex flex-col gap-5">
                      <div className="grid grid-cols-3 gap-4 bg-dark-900/30 border border-white/5 rounded-3xl p-5 text-center">
                        <div>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Score</p>
                          <p className="text-2xl font-black text-brand-purple">{Math.round(submitResults.score)} pts</p>
                        </div>
                        <div className="border-x border-white/5">
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Passed Cases</p>
                          <p className="text-2xl font-black text-white">{submitResults.passed_test_cases} / {submitResults.total_test_cases}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Success Rate</p>
                          <p className="text-2xl font-black text-brand-green">{Math.round((submitResults.passed_test_cases / submitResults.total_test_cases) * 100)}%</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Test Case List</h4>
                        <div className="flex flex-col gap-2.5 max-h-[350px] overflow-y-auto pr-1">
                          {submitResults.test_case_results.map((tc, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3.5 bg-dark-950 border border-white/5 rounded-2xl">
                              <div className="flex items-center gap-2.5">
                                {tc.passed ? (
                                  <CheckCircle2 className="w-5 h-5 text-brand-green" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-rose-500" />
                                )}
                                <span className="text-xs font-bold text-gray-300">Test Case #{idx + 1}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-gray-500 font-bold">{Math.round(tc.execution_time_ms)}ms</span>
                                {tc.error && (
                                  <p className="text-[10px] text-rose-400 font-medium max-w-xs mt-0.5 line-clamp-1">{tc.error}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: IDE Editor */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-dark-950">
          <div className="flex-1 min-h-0 relative border-b border-white/5">
            <Editor
              height="100%"
              language={language === 'cpp' ? 'cpp' : language}
              theme="vs-dark"
              value={code}
              onChange={(value) => setCode(value || '')}
              options={{
                fontSize: 14,
                fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                scrollbar: {
                  vertical: 'visible',
                  horizontal: 'visible'
                },
                inlineSuggest: { enabled: true, mode: 'subword' },
                suggest: { preview: true }
              }}
            />
          </div>

          {/* Action Trigger Buttons */}
          <div className="px-6 py-4 bg-dark-900/30 flex items-center justify-between gap-4">
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider flex items-center gap-2">
              <Code className="w-4 h-4 text-brand-purple" />
              Editor Workspace
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRunCode}
                disabled={running || submitting}
                className="px-5 py-2.5 bg-dark-950 border border-white/5 rounded-2xl text-xs font-bold hover:bg-dark-800 text-gray-200 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Run Code
              </button>
              <button
                onClick={handleSubmitSolution}
                disabled={running || submitting}
                className="px-5 py-2.5 bg-brand-purple hover:bg-brand-purple/90 shadow-lg shadow-brand-purple/10 hover:shadow-brand-purple/20 rounded-2xl text-xs font-bold text-white transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                Submit Solution
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Achievement Unlocked Dialog */}
      {showAchievementsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm bg-dark-900 border border-brand-purple/30 rounded-3xl p-6 text-center shadow-2xl shadow-brand-purple/10 flex flex-col items-center gap-4 animate-in zoom-in duration-300">
            <div className="w-16 h-16 rounded-full bg-brand-purple/10 border border-brand-purple/20 flex items-center justify-center text-brand-purple animate-bounce">
              <Trophy className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white">Achievement Unlocked!</h3>
              <p className="text-gray-400 text-xs mt-1">
                You unlocked new achievement badges for your coding performance:
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full mt-2">
              {newAchievements.map((badge, idx) => (
                <div key={idx} className="bg-brand-purple/5 border border-brand-purple/15 text-brand-purple text-xs font-black py-2 rounded-xl">
                  {badge.replace(/_/g, ' ')}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowAchievementsModal(false)}
              className="mt-2 w-full py-2.5 bg-brand-purple text-white text-xs font-bold rounded-2xl hover:bg-brand-purple/90"
            >
              Awesome!
            </button>
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
