import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { 
  Share2, 
  Copy, 
  Check, 
  FolderGit2, 
  Play, 
  Globe, 
  EyeOff, 
  Lock, 
  Clock, 
  Calendar, 
  Code,
  User,
  ChevronLeft
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';
import Toast from '../components/Toast';

export default function SharedCodePage() {
  const { share_id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [forking, setForking] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchSharedCode = async () => {
      try {
        const res = await api.get(`/share/${share_id}`);
        setShare(res.data);
      } catch (err) {
        setToast({ 
          message: err.response?.data?.detail || 'Shared code snippet not found or expired.', 
          type: 'error' 
        });
      } finally {
        setLoading(false);
      }
    };
    fetchSharedCode();
  }, [share_id]);

  // SEO Optimization
  useEffect(() => {
    if (share) {
      document.title = `${share.title} - Shared Code - DYC Coding Campus`;
      
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = share.description || `Shared ${share.language} code snippet on DYC Coding Campus`;
    }
  }, [share]);

  if (loading) {
    return <Loader fullScreen={true} />;
  }

  if (!share) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-dark-950 text-gray-100 p-6">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mb-4">
          <EyeOff className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold">Snippet Unavailable</h1>
        <p className="text-gray-400 text-sm mt-2 text-center max-w-md">
          This snippet might be private, expired, deleted by its owner, or the link is invalid.
        </p>
        <Link 
          to={user ? "/dashboard" : "/"} 
          className="mt-6 flex items-center gap-2 bg-gradient-to-r from-brand-purple to-brand-violet hover:opacity-95 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-brand-purple/20 transition"
        >
          <ChevronLeft className="w-4.5 h-4.5" />
          {user ? 'Back to Dashboard' : 'Back to Home'}
        </Link>
      </div>
    );
  }

  const handleCopyLink = async () => {
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      setToast({ message: 'Share link copied to clipboard!', type: 'success' });
      
      // Track copy action in backend
      await api.post(`/share/${share_id}/copy`).catch(() => {});
      setShare(prev => prev ? { ...prev, link_copies: prev.link_copies + 1 } : null);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(share.source_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
      setToast({ message: 'Source code copied to clipboard!', type: 'success' });
    } catch (err) {
      console.error('Failed to copy code', err);
    }
  };

  const handleFork = async () => {
    if (!user) {
      setToast({ message: 'Please log in or register to fork this code snippet.', type: 'error' });
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    if (share.user_id === user.id) {
      setToast({ message: 'You cannot fork your own shared snippet.', type: 'error' });
      return;
    }

    setForking(true);
    try {
      const res = await api.post(`/share/${share_id}/fork`);
      setToast({ message: 'Snippet successfully forked to your workspace!', type: 'success' });
      setShare(prev => prev ? { ...prev, forks: prev.forks + 1 } : null);
      
      // Redirect to the newly created program editor
      setTimeout(() => {
        navigate(`/editor/${res.data.id}`);
      }, 1500);
    } catch (err) {
      setToast({ 
        message: err.response?.data?.detail || 'Failed to fork snippet.', 
        type: 'error' 
      });
    } finally {
      setForking(false);
    }
  };

  const getMonacoLanguage = (lang) => {
    if (lang === 'cpp') return 'cpp';
    if (lang === 'python') return 'python';
    if (lang === 'javascript') return 'javascript';
    if (lang === 'c') return 'c';
    if (lang === 'java') return 'java';
    return 'plaintext';
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-dark-950 text-gray-100">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Header bar */}
      <header className="h-16 border-b border-white/5 bg-dark-900/60 backdrop-blur-md px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2 text-brand-purple font-black text-lg">
            <span className="bg-gradient-to-r from-brand-purple to-brand-violet text-transparent bg-clip-text">DYC COMPILER</span>
          </Link>
          <span className="h-4 w-px bg-white/10"></span>
          <div>
            <h1 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              {share.title}
              <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-gray-400 font-mono">
                {share.language}
              </span>
            </h1>
            <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-2">
              <span className="flex items-center gap-1"><User className="w-3 h-3" /> Shared Code</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> 
                {new Date(share.created_at).toLocaleDateString()}
              </span>
            </p>
          </div>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyLink}
            className={`flex items-center gap-1.5 px-4 py-2 border border-white/5 bg-dark-900/60 rounded-xl text-xs font-semibold text-gray-300 transition ${
              copiedLink ? 'border-emerald-500/20 text-emerald-400' : 'hover:border-brand-purple/20 hover:bg-dark-800/80'
            }`}
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4 text-brand-purple" />}
            Copy Link
          </button>
          
          <button
            onClick={handleCopyCode}
            className={`flex items-center gap-1.5 px-4 py-2 border border-white/5 bg-dark-900/60 rounded-xl text-xs font-semibold text-gray-300 transition ${
              copiedCode ? 'border-emerald-500/20 text-emerald-400' : 'hover:border-brand-purple/20 hover:bg-dark-800/80'
            }`}
          >
            {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-brand-purple" />}
            Copy Code
          </button>

          <button
            onClick={handleFork}
            disabled={forking || (user && share.user_id === user.id)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-brand-purple to-brand-violet hover:opacity-95 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg shadow-brand-purple/20 transition disabled:opacity-50"
          >
            <FolderGit2 className="w-4 h-4" />
            {forking ? 'Forking...' : 'Fork Snippet'}
          </button>
        </div>
      </header>

      {/* Editor & Metadata Panel */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        
        {/* Monaco Workspace */}
        <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-white/5 min-h-[350px] md:min-h-0">
          <div className="flex items-center justify-between px-6 py-2 border-b border-white/5 bg-dark-950/20 text-xs">
            <span className="text-gray-400">Code Sandbox Viewer (Read-only)</span>
            <span className="text-brand-purple font-mono uppercase font-bold">{share.language}</span>
          </div>
          
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language={getMonacoLanguage(share.language)}
              value={share.source_code}
              theme="vs-dark"
              options={{
                fontSize: 14,
                fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
                minimap: { enabled: false },
                lineNumbers: 'on',
                roundedSelection: true,
                scrollBeyondLastLine: false,
                readOnly: true,
                automaticLayout: true,
                padding: { top: 10, bottom: 10 },
                domReadOnly: true
              }}
            />
          </div>
        </div>

        {/* Details and Metrics Panel */}
        <div className="w-full md:w-80 flex flex-col bg-dark-950/40 p-6 gap-6 flex-shrink-0 overflow-y-auto">
          {/* Snippet Description */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</h3>
            {share.description ? (
              <p className="text-sm text-gray-300 bg-white/5 border border-white/10 p-4 rounded-2xl leading-relaxed whitespace-pre-wrap">
                {share.description}
              </p>
            ) : (
              <p className="text-xs text-gray-500 italic bg-white/5 border border-white/10 p-4 rounded-2xl">
                No description provided for this code snippet.
              </p>
            )}
          </div>

          {/* Snippet Metrics */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Activity Metrics</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl text-center">
                <span className="text-[10px] text-gray-500 font-bold block uppercase tracking-wider">Views</span>
                <span className="text-lg font-black text-white mt-1 block">{share.views}</span>
              </div>
              <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl text-center">
                <span className="text-[10px] text-gray-500 font-bold block uppercase tracking-wider">Forks</span>
                <span className="text-lg font-black text-white mt-1 block">{share.forks}</span>
              </div>
              <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl text-center">
                <span className="text-[10px] text-gray-500 font-bold block uppercase tracking-wider">Copies</span>
                <span className="text-lg font-black text-white mt-1 block">{share.link_copies}</span>
              </div>
            </div>
          </div>

          {/* Snippet Attributes */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Snippet Details</h3>
            <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col gap-3.5 text-xs text-gray-400">
              <div className="flex items-center justify-between">
                <span>Visibility:</span>
                <span className="font-bold capitalize text-gray-200 flex items-center gap-1">
                  {share.visibility === 'public' && <Globe className="w-3.5 h-3.5 text-brand-purple" />}
                  {share.visibility === 'unlisted' && <EyeOff className="w-3.5 h-3.5 text-brand-teal" />}
                  {share.visibility === 'private' && <Lock className="w-3.5 h-3.5 text-rose-400" />}
                  {share.visibility}
                </span>
              </div>
              {share.expires_at && (
                <div className="flex items-center justify-between">
                  <span>Expires At:</span>
                  <span className="font-bold text-gray-200 flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-brand-purple" />
                    {new Date(share.expires_at).toLocaleDateString()}
                  </span>
                </div>
              )}
              {share.is_challenge_solution && (
                <div className="flex items-center justify-between">
                  <span>Solution For:</span>
                  <span className="font-bold text-brand-teal uppercase font-mono">Challenge</span>
                </div>
              )}
            </div>
          </div>

          {/* Developer Call to Action */}
          <div className="mt-auto bg-gradient-to-r from-brand-purple/10 to-brand-violet/5 border border-brand-purple/20 p-4 rounded-2xl text-center flex flex-col gap-3">
            <p className="text-xs text-gray-300 leading-relaxed font-semibold">
              Want to compile, edit, or test code in the browser?
            </p>
            <Link
              to={user ? "/dashboard" : "/register"}
              className="bg-brand-purple hover:bg-brand-purple/90 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition shadow-lg shadow-brand-purple/20 block"
            >
              {user ? 'Open Workspace' : 'Get Free Sandbox'}
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
