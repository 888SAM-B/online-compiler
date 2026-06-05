import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trophy, 
  Award, 
  Calendar, 
  Download, 
  ExternalLink, 
  Share2, 
  FileText,
  Bookmark
} from 'lucide-react';
import api from '../api';
import Loader from '../components/Loader';

export default function MyCertificates() {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/assessments/certificates');
      setCertificates(res.data);
    } catch (err) {
      console.error('Failed to fetch certificates:', err);
      setError('Failed to fetch your certificates. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getBadgeColor = (badgeName) => {
    switch (badgeName?.toLowerCase()) {
      case 'gold': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'silver': return 'bg-gray-300/10 text-gray-300 border-gray-300/20';
      case 'bronze': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getBadgeIconColor = (badgeName) => {
    switch (badgeName?.toLowerCase()) {
      case 'gold': return 'text-amber-400';
      case 'silver': return 'text-gray-300';
      case 'bronze': return 'text-orange-400';
      default: return 'text-gray-500';
    }
  };

  const handleShare = (certificateId) => {
    const shareUrl = `${window.location.origin}/verify-certificate/${certificateId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      alert('Certificate verification link copied to clipboard!');
    } else {
      alert(`Certificate Link: ${shareUrl}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10 bg-dark-950">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Trophy className="w-8 h-8 text-brand-purple" />
              My Certifications
            </h1>
            <p className="text-gray-400 mt-1.5 text-sm">
              Manage, view, and share all your verified achievements and certifications.
            </p>
          </div>
          <button
            onClick={() => navigate('/assessments')}
            className="self-start px-5 py-2.5 rounded-xl border border-white/5 bg-dark-900/40 hover:bg-dark-900 text-gray-300 hover:text-white font-bold text-xs transition-all"
          >
            Take More Assessments
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm font-semibold">
            {error}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader />
          </div>
        ) : certificates.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-3xl p-10 bg-dark-950/20">
            <Bookmark className="w-12 h-12 text-gray-600 mb-3" />
            <h3 className="text-white font-bold text-lg">No Certificates Earned Yet</h3>
            <p className="text-gray-500 text-sm mt-1 text-center max-w-sm">
              Pass any assessment with a score of 50% or above to unlock beautiful PDF certificates and badges.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="group relative flex flex-col justify-between bg-dark-900/20 border border-white/5 hover:border-brand-purple/20 rounded-3xl p-6 hover:shadow-2xl hover:shadow-brand-purple/5 hover:-translate-y-0.5 transition-all duration-300"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase border ${getBadgeColor(cert.badge)}`}>
                      {cert.badge} Badge
                    </span>
                    <span className="text-[10px] text-gray-500 font-semibold font-mono bg-dark-950 px-2 py-0.5 rounded border border-white/5">
                      ID: {cert.certificate_id}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-brand-purple transition-colors">
                    {cert.assessment_title}
                  </h3>
                  
                  {/* Badge emblem display inside card */}
                  <div className="my-5 flex items-center gap-3 p-3 bg-dark-950/60 border border-white/5 rounded-2xl">
                    <Award className={`w-10 h-10 shrink-0 ${getBadgeIconColor(cert.badge)}`} />
                    <div>
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Scored</p>
                      <p className="text-xs font-bold text-white">{cert.percentage}% Grade</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar className="w-4 h-4 text-brand-purple shrink-0" />
                    <span>Issued: {new Date(cert.issued_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 border-t border-white/5 pt-4 flex gap-2">
                  <button
                    onClick={() => navigate(`/verify-certificate/${cert.certificate_id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-brand-purple hover:bg-brand-purple/95 text-white text-xs font-bold transition-all shadow-md shadow-brand-purple/10"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Verify
                  </button>
                  <a
                    href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/assessments/certificates/${cert.certificate_id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center p-2.5 rounded-xl bg-dark-950 border border-white/5 hover:border-white/10 text-gray-400 hover:text-white transition-all"
                    title="Download PDF Certificate"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleShare(cert.certificate_id)}
                    className="flex items-center justify-center p-2.5 rounded-xl bg-dark-950 border border-white/5 hover:border-white/10 text-gray-400 hover:text-white transition-all"
                    title="Share verification link"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
