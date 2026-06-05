import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Trophy, 
  Award, 
  XCircle, 
  CheckCircle2, 
  FileText, 
  ArrowRight, 
  RotateCcw,
  Sparkles,
  Calendar,
  Clock,
  ChevronRight
} from 'lucide-react';
import api from '../api';
import Loader from '../components/Loader';

export default function AssessmentResultPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [attemptDetails, setAttemptDetails] = useState(null);
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Submit response might have been passed in navigation state
  const stateData = location.state;

  useEffect(() => {
    fetchResultDetails();
  }, [attemptId]);

  const fetchResultDetails = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch history to find this specific attempt
      const historyRes = await api.get('/assessments/history');
      const foundAttempt = historyRes.data.find(a => a.id === attemptId);
      
      if (!foundAttempt) {
        throw new Error('Attempt details not found');
      }
      setAttemptDetails(foundAttempt);

      // If passed, look up the certificate
      if (foundAttempt.passed) {
        const certsRes = await api.get('/assessments/certificates');
        const foundCert = certsRes.data.find(c => c.attempt_id === attemptId);
        if (foundCert) {
          setCertificate(foundCert);
        }
      }
    } catch (err) {
      console.error('Failed to load result details:', err);
      setError('Failed to load assessment results. Please check your history in the dashboard.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-dark-950">
        <Loader />
      </div>
    );
  }

  if (error || !attemptDetails) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-dark-950 p-6">
        <XCircle className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Error Loading Results</h2>
        <p className="text-gray-400 text-center max-w-md mb-6">{error || 'Attempt not found.'}</p>
        <button
          onClick={() => navigate('/assessments')}
          className="px-5 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white font-bold text-sm"
        >
          Back to Assessments
        </button>
      </div>
    );
  }

  const { assessment_title, score, percentage, badge, passed, submitted_at, duration_taken_seconds } = attemptDetails;
  
  // Achievements unlocked in state or default
  const achievements = stateData?.unlocked_achievements || [];

  const getBadgeColor = (badgeName) => {
    switch (badgeName?.toLowerCase()) {
      case 'gold': return 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]';
      case 'silver': return 'text-gray-300 drop-shadow-[0_0_8px_rgba(209,213,219,0.3)]';
      case 'bronze': return 'text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.3)]';
      default: return 'text-gray-500';
    }
  };

  const getBadgeLabel = (badgeName) => {
    switch (badgeName?.toLowerCase()) {
      case 'gold': return 'Gold Certification Badge';
      case 'silver': return 'Silver Certification Badge';
      case 'bronze': return 'Bronze Certification Badge';
      default: return 'No Badge';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10 bg-dark-950 relative">
      {/* Decorative Background Glows */}
      {passed && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-purple/5 blur-[120px] rounded-full pointer-events-none" />
      )}

      <div className="max-w-3xl mx-auto flex flex-col gap-8 relative z-10">
        
        {/* Navigation back */}
        <button
          onClick={() => navigate('/assessments')}
          className="self-start flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-white transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Back to Assessments
        </button>

        {/* Results Card Header */}
        <div className={`border rounded-[32px] p-8 md:p-10 flex flex-col items-center text-center backdrop-blur-md ${
          passed 
            ? 'bg-brand-green/5 border-brand-green/20' 
            : 'bg-rose-500/5 border-rose-500/20'
        }`}>
          {passed ? (
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-brand-green/30 blur-md animate-pulse" />
              <CheckCircle2 className="w-20 h-20 text-brand-green relative z-10" />
            </div>
          ) : (
            <XCircle className="w-20 h-20 text-rose-500" />
          )}

          <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-6">
            {passed ? 'Congratulations! You Passed!' : 'Assessment Completed'}
          </h1>
          <p className="text-gray-400 text-sm mt-2 max-w-md">
            You have completed the <span className="text-white font-bold">{assessment_title}</span>. Below is your detailed performance report.
          </p>

          {/* Large Score Indicator */}
          <div className="mt-8 flex items-baseline gap-1">
            <span className={`text-6xl font-black ${passed ? 'text-brand-green' : 'text-rose-400'}`}>
              {percentage}%
            </span>
            <span className="text-gray-500 font-bold text-lg">score</span>
          </div>

          <div className="mt-2 text-xs font-semibold text-gray-400 bg-dark-950/80 px-4 py-1.5 border border-white/5 rounded-full">
            {score} Correct Answers
          </div>

          {/* Badge Unlocked Area */}
          {passed && badge !== 'failed' && (
            <div className="mt-8 flex flex-col items-center gap-2 p-5 bg-dark-950/60 border border-white/5 rounded-2xl w-full max-w-sm">
              <Award className={`w-14 h-14 ${getBadgeColor(badge)}`} />
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Achievement Badge Unlocked</p>
                <p className="text-sm font-extrabold text-white capitalize mt-0.5">{getBadgeLabel(badge)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Exam Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-dark-900/20 border border-white/5 rounded-2xl p-5 flex items-center gap-4">
            <Clock className="w-8 h-8 text-brand-purple shrink-0" />
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Duration Taken</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {Math.floor(duration_taken_seconds / 60)} minutes {duration_taken_seconds % 60} seconds
              </p>
            </div>
          </div>
          <div className="bg-dark-900/20 border border-white/5 rounded-2xl p-5 flex items-center gap-4">
            <Calendar className="w-8 h-8 text-brand-purple shrink-0" />
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Submitted On</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {new Date(submitted_at).toLocaleDateString()} {new Date(submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>

        {/* Unlocked Achievements/Badges Alerts */}
        {achievements.length > 0 && (
          <div className="bg-brand-purple/10 border border-brand-purple/20 rounded-3xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-white font-extrabold text-sm">
              <Sparkles className="w-5 h-5 text-amber-400" />
              New Achievement Badges Unlocked!
            </div>
            <div className="flex flex-wrap gap-2.5">
              {achievements.map((ach, idx) => (
                <span 
                  key={idx}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-dark-950 text-xs font-bold text-amber-400 border border-amber-400/20"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  {ach.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Certificate Actions Area */}
        {passed && certificate && (
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => navigate(`/verify-certificate/${certificate.certificate_id}`)}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-brand-green hover:bg-brand-green/95 text-white font-bold text-sm shadow-lg shadow-brand-green/20 transition-all duration-300"
            >
              <CheckCircle2 className="w-4 h-4" />
              Verify Certificate Online
            </button>
            <a
              href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/assessments/certificates/${certificate.certificate_id}/download`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-dark-900 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white font-bold text-sm transition-all"
            >
              <FileText className="w-4 h-4 text-brand-purple" />
              Download PDF Certificate
            </a>
          </div>
        )}

        {/* Exit Actions */}
        <div className="flex justify-center mt-6">
          <button
            onClick={() => navigate('/assessments')}
            className="flex items-center gap-1 text-xs text-brand-purple font-bold hover:underline"
          >
            Go back to Assessments dashboard
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
