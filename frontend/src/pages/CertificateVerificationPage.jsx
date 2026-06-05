import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  ShieldAlert, 
  User, 
  Award, 
  Calendar, 
  Percent, 
  Download, 
  ArrowLeft,
  BookOpen
} from 'lucide-react';
import axios from 'axios';
import Loader from '../components/Loader';

export default function CertificateVerificationPage() {
  const { certificate_id: certificateId } = useParams();
  const navigate = useNavigate();
  const [verificationData, setVerificationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    verifyCertificate();
  }, [certificateId]);

  const verifyCertificate = async () => {
    setLoading(true);
    setError('');
    try {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      // Public route, call via axios directly to avoid JWT auth dependency if user is logged out
      const res = await axios.get(`${baseURL}/assessments/certificates/verify/${certificateId}`);
      setVerificationData(res.data);
    } catch (err) {
      console.error('Failed to verify certificate:', err);
      setError('Certificate verification failed. The certificate ID might be invalid or there was a system error.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-screen bg-dark-950 flex items-center justify-center p-6 text-gray-100">
        <Loader />
      </div>
    );
  }

  const getBadgeColor = (badgeName) => {
    switch (badgeName?.toLowerCase()) {
      case 'gold': return 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.2)]';
      case 'silver': return 'text-gray-300 drop-shadow-[0_0_8px_rgba(209,213,219,0.2)]';
      case 'bronze': return 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.2)]';
      default: return 'text-gray-500';
    }
  };

  const getBadgeBg = (badgeName) => {
    switch (badgeName?.toLowerCase()) {
      case 'gold': return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'silver': return 'bg-gray-300/10 border-gray-300/20 text-gray-300';
      case 'bronze': return 'bg-orange-500/10 border-orange-500/20 text-orange-400';
      default: return 'bg-gray-500/10 border-white/5 text-gray-400';
    }
  };

  const isValid = verificationData && verificationData.valid && !verificationData.revoked;

  return (
    <div className="min-h-screen w-screen bg-dark-950 flex flex-col justify-between p-6 md:p-10 text-gray-100 overflow-y-auto">
      
      {/* Decorative top bar */}
      <header className="max-w-3xl w-full mx-auto flex items-center justify-between shrink-0 mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-purple flex items-center justify-center font-black text-white text-base">C</div>
          <span className="font-extrabold tracking-tight text-white text-md">Coding Campus</span>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Workspace
        </button>
      </header>

      {/* Verification Card Body */}
      <main className="max-w-xl w-full mx-auto my-auto flex-1 flex flex-col justify-center">
        {error ? (
          <div className="bg-dark-900/30 border border-rose-500/20 rounded-3xl p-8 text-center backdrop-blur-md">
            <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Verification Error</h2>
            <p className="text-gray-400 text-sm mb-6">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-xl bg-brand-purple hover:bg-brand-purple/95 text-white font-bold text-xs"
            >
              Go to Home Page
            </button>
          </div>
        ) : isValid ? (
          <div className="bg-dark-900/30 border border-brand-green/20 rounded-[32px] p-8 md:p-10 backdrop-blur-md relative overflow-hidden shadow-2xl shadow-brand-green/5">
            {/* Holographic style corner pattern */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-green/5 blur-xl rounded-full" />
            
            <div className="flex flex-col items-center text-center">
              <ShieldCheck className="w-16 h-16 text-brand-green mb-4 drop-shadow-[0_0_8px_rgba(34,197,94,0.3)] animate-pulse" />
              <span className="px-3 py-1 rounded-full bg-brand-green/10 border border-brand-green/20 text-brand-green text-[10px] font-extrabold uppercase tracking-widest">
                VERIFIED CREDENTIAL
              </span>

              <h2 className="text-2xl font-black text-white mt-6 select-all">
                {verificationData.certificate_id}
              </h2>
              <p className="text-[11px] text-gray-500 font-mono mt-1">Verification Hash Authenticated</p>
            </div>

            {/* Details Table */}
            <div className="mt-8 flex flex-col gap-4 border-t border-white/5 pt-6">
              
              <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                <div className="flex items-center gap-2.5 text-gray-400">
                  <User className="w-4 h-4 text-brand-purple shrink-0" />
                  <span className="text-xs font-semibold">Recipient Name</span>
                </div>
                <span className="text-xs font-bold text-white">{verificationData.user_name}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                <div className="flex items-center gap-2.5 text-gray-400">
                  <BookOpen className="w-4 h-4 text-brand-purple shrink-0" />
                  <span className="text-xs font-semibold">Certification</span>
                </div>
                <span className="text-xs font-bold text-white text-right max-w-[200px] truncate">{verificationData.assessment_title}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                <div className="flex items-center gap-2.5 text-gray-400">
                  <Percent className="w-4 h-4 text-brand-purple shrink-0" />
                  <span className="text-xs font-semibold">Assessment Score</span>
                </div>
                <span className="text-xs font-bold text-brand-green font-mono">{verificationData.percentage}%</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                <div className="flex items-center gap-2.5 text-gray-400">
                  <Award className="w-4 h-4 text-brand-purple shrink-0" />
                  <span className="text-xs font-semibold">Earned Badge</span>
                </div>
                <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-extrabold uppercase border ${getBadgeBg(verificationData.badge)}`}>
                  {verificationData.badge}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2.5 text-gray-400">
                  <Calendar className="w-4 h-4 text-brand-purple shrink-0" />
                  <span className="text-xs font-semibold">Issued Date</span>
                </div>
                <span className="text-xs font-bold text-white">
                  {new Date(verificationData.issued_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Direct download for verification page */}
            <div className="mt-8 border-t border-white/5 pt-6">
              <a
                href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/assessments/certificates/${verificationData.certificate_id}/download`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-dark-950 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-xs font-bold transition-all"
              >
                <Download className="w-3.5 h-3.5 text-brand-green" />
                Download PDF Copy
              </a>
            </div>
          </div>
        ) : (
          <div className="bg-dark-900/30 border border-rose-500/20 rounded-[32px] p-8 md:p-10 text-center backdrop-blur-md">
            <ShieldAlert className="w-16 h-16 text-rose-500 mx-auto mb-4" />
            <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-extrabold uppercase tracking-widest">
              REVOKED CREDENTIAL
            </span>

            <h2 className="text-2xl font-black text-white mt-6">
              {certificateId}
            </h2>
            <p className="text-gray-400 text-sm mt-3 leading-relaxed">
              This certificate has been revoked and is no longer recognized as a valid credential.
            </p>

            {verificationData && verificationData.revoked_reason && (
              <div className="mt-5 p-3.5 bg-rose-950/20 border border-rose-500/10 rounded-2xl text-xs text-rose-300">
                <span className="font-bold">Reason:</span> {verificationData.revoked_reason}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center text-[10px] text-gray-600 shrink-0 mt-8">
        &copy; {new Date().getFullYear()} Coding Campus. All certificates are cryptographically verified.
      </footer>
    </div>
  );
}
