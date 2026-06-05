import React, { useState } from 'react';
import { 
  Share2, 
  Copy, 
  Check, 
  Clock, 
  Globe, 
  EyeOff, 
  Lock, 
  X,
  AlertTriangle
} from 'lucide-react';
import api from '../api';

export default function ShareCodeModal({ isOpen, onClose, code, language, currentTitle }) {
  const [title, setTitle] = useState(currentTitle || 'Shared Code Snippet');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('unlisted');
  const [expiresInHours, setExpiresInHours] = useState('never');
  const [isChallengeSolution, setIsChallengeSolution] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shareData, setShareData] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleShare = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a title');
      return;
    }
    if (code.length > 102400) {
      setError('Source code exceeds 100KB limit');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        title,
        description: description.trim() || null,
        language,
        source_code: code,
        visibility,
        expires_in_hours: expiresInHours === 'never' ? null : parseInt(expiresInHours),
        is_challenge_solution: isChallengeSolution
      };

      const res = await api.post('/share', payload);
      setShareData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create share link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getShareUrl = () => {
    if (!shareData) return '';
    return `${window.location.origin}/share/${shareData.share_id}`;
  };

  const handleCopyLink = async () => {
    if (!shareData) return;
    const shareUrl = getShareUrl();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      // Track copy action in backend
      await api.post(`/share/${shareData.share_id}/copy`).catch(() => {});
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const resetModal = () => {
    setTitle(currentTitle || 'Shared Code Snippet');
    setDescription('');
    setVisibility('unlisted');
    setExpiresInHours('never');
    setIsChallengeSolution(false);
    setShareData(null);
    setError('');
    setCopied(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="glass w-full max-w-lg flex flex-col p-6 rounded-2xl border border-white/10 shadow-2xl relative animate-fade-in text-left">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
          <div className="flex items-center gap-2 text-brand-purple">
            <Share2 className="w-5 h-5" />
            <h3 className="text-lg font-bold text-gray-100">Share Source Code</h3>
          </div>
          <button
            onClick={resetModal}
            className="text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!shareData ? (
          <form onSubmit={handleShare} className="flex flex-col gap-4">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400">Snippet Title</label>
              <input
                type="text"
                maxLength={100}
                required
                placeholder="e.g., Fibonnaci Sequence Helper"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple focus:border-brand-purple transition-all"
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400">Description (Optional)</label>
              <textarea
                rows={3}
                maxLength={1000}
                placeholder="Brief summary of what this code snippet does..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple focus:border-brand-purple transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Visibility */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-400">Visibility</label>
                <div className="relative">
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    disabled={isChallengeSolution}
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple focus:border-brand-purple transition-all appearance-none cursor-pointer"
                  >
                    <option value="unlisted">Unlisted (URL holders)</option>
                    <option value="public">Public (Snippet Gallery)</option>
                    <option value="private">Private (Only You)</option>
                  </select>
                </div>
              </div>

              {/* Expiration */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-400">Expires In</label>
                <div className="relative">
                  <select
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-950 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-brand-purple focus:border-brand-purple transition-all appearance-none cursor-pointer"
                  >
                    <option value="never">Never Expire</option>
                    <option value="1">1 Hour</option>
                    <option value="24">24 Hours</option>
                    <option value="168">7 Days</option>
                    <option value="720">30 Days</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Is Challenge Solution */}
            <div className="flex items-center gap-2 mt-2 bg-dark-950/40 p-3 rounded-xl border border-white/5">
              <input
                type="checkbox"
                id="isChallengeSolution"
                checked={isChallengeSolution}
                onChange={(e) => {
                  const val = e.target.checked;
                  setIsChallengeSolution(val);
                  if (val) {
                    setVisibility('unlisted'); // Force visibility to unlisted if challenge solution
                  }
                }}
                className="w-4 h-4 rounded text-brand-purple focus:ring-brand-purple bg-dark-950 border-white/10 cursor-pointer"
              />
              <label htmlFor="isChallengeSolution" className="text-xs text-gray-300 font-medium select-none cursor-pointer">
                This is a coding challenge solution
              </label>
            </div>

            {isChallengeSolution && (
              <p className="text-[10px] text-brand-teal font-medium leading-relaxed bg-brand-teal/5 p-2 rounded border border-brand-teal/10">
                💡 Challenge solutions are automatically restricted to **Unlisted** visibility to prevent public answers leaks while still allowing private sharing.
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-purple to-brand-violet hover:opacity-95 px-5 py-3 rounded-xl text-sm font-bold text-white shadow-lg shadow-brand-purple/20 transition disabled:opacity-50"
            >
              {loading ? 'Generating Link...' : 'Generate Shareable Link'}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-5 py-2">
            <div className="text-center flex flex-col items-center gap-2 mb-2">
              <div className="w-12 h-12 rounded-full bg-brand-purple/10 flex items-center justify-center text-brand-purple mb-2">
                <Share2 className="w-6 h-6 animate-pulse" />
              </div>
              <h4 className="font-bold text-gray-100">Snippet Shared Successfully!</h4>
              <p className="text-xs text-gray-400">Anyone with this link can now view your read-only code.</p>
            </div>

            {/* Link Copy Box */}
            <div className="flex items-center gap-2 bg-dark-950 border border-white/10 p-2.5 rounded-xl">
              <input
                type="text"
                readOnly
                value={getShareUrl()}
                className="bg-transparent flex-1 text-xs text-gray-300 px-2 select-all focus:outline-none font-mono"
              />
              <button
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition ${
                  copied 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple border border-brand-purple/20 hover:text-white'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>

            {/* Share Meta Info */}
            <div className="bg-dark-950/60 p-4 rounded-xl border border-white/5 flex flex-col gap-2.5 text-xs text-gray-400">
              <div className="flex items-center justify-between">
                <span>Visibility:</span>
                <span className="font-bold capitalize text-gray-200 flex items-center gap-1">
                  {shareData.visibility === 'public' && <Globe className="w-3.5 h-3.5 text-brand-purple" />}
                  {shareData.visibility === 'unlisted' && <EyeOff className="w-3.5 h-3.5 text-brand-teal" />}
                  {shareData.visibility === 'private' && <Lock className="w-3.5 h-3.5 text-rose-400" />}
                  {shareData.visibility}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Language:</span>
                <span className="font-mono font-bold uppercase text-brand-purple">{shareData.language}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Expiration:</span>
                <span className="font-bold text-gray-200 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {shareData.expires_at 
                    ? new Date(shareData.expires_at).toLocaleString() 
                    : 'Never'
                  }
                </span>
              </div>
            </div>

            <button
              onClick={resetModal}
              className="w-full py-2.5 border border-white/5 hover:bg-white/5 text-gray-300 rounded-xl text-xs font-semibold transition"
            >
              Close Window
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
