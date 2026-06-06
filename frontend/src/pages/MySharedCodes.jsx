import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Share2, 
  Trash2, 
  Copy, 
  Check, 
  ExternalLink, 
  Globe, 
  EyeOff, 
  Lock, 
  Clock,
  Eye,
  FolderGit2,
  AlertTriangle
} from 'lucide-react';
import api from '../api';
import Loader from '../components/Loader';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

export default function MySharedCodes() {
  const toast = useToast();
  const confirm = useConfirm();
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);

  const fetchShares = async () => {
    try {
      const res = await api.get('/share/my');
      setShares(res.data);
    } catch (err) {
      toast.error('Failed to fetch shared snippets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShares();
  }, []);

  const handleCopyLink = async (shareId) => {
    const shareUrl = `${window.location.origin}/share/${shareId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedId(shareId);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success('Share link copied!');
      
      // Track copy action in backend
      await api.post(`/share/${shareId}/copy`).catch(() => {});
      
      // Update local view metrics for copies
      setShares(prev => prev.map(s => s.share_id === shareId ? { ...s, link_copies: s.link_copies + 1 } : s));
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDelete = async (shareId, title) => {
    const ok = await confirm({
      title: 'Delete Share Link',
      message: `Are you sure you want to delete the shared snippet "${title}"? This action cannot be undone and the link will no longer work.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      danger: true
    });
    if (!ok) return;

    try {
      await api.delete(`/share/${shareId}`);
      setShares(shares.filter(s => s.share_id !== shareId));
      toast.success('Shared snippet deleted successfully.');
    } catch (err) {
      toast.error('Failed to delete shared snippet.');
    }
  };

  if (loading) {
    return <Loader fullScreen={true} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 text-left">

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Shared Snippets</h1>
        <p className="text-sm text-gray-400 mt-1">Manage and track analytics for all shared code templates.</p>
      </div>

      <div className="glass p-6 rounded-2xl flex flex-col min-w-0">
        <h2 className="text-lg font-bold mb-4">My Shared Codes</h2>
        
        <div className="flex-1 overflow-x-auto min-h-[300px]">
          {shares.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 py-16 gap-3">
              <Share2 className="w-12 h-12 text-gray-600 animate-pulse" />
              <p className="text-sm">You haven't shared any snippets yet.</p>
              <Link 
                to="/dashboard" 
                className="text-brand-purple hover:underline text-xs font-semibold"
              >
                Go to Editor to share code
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-white/5 pb-2 text-xs uppercase font-bold tracking-wider">
                  <th className="text-left pb-3 font-semibold">Title</th>
                  <th className="text-left pb-3 font-semibold">Language</th>
                  <th className="text-left pb-3 font-semibold">Visibility</th>
                  <th className="text-left pb-3 font-semibold">Expiration</th>
                  <th className="text-center pb-3 font-semibold">Views</th>
                  <th className="text-center pb-3 font-semibold">Forks</th>
                  <th className="text-center pb-3 font-semibold">Copies</th>
                  <th className="text-right pb-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {shares.map((share) => (
                  <tr key={share.share_id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 pr-3 font-medium text-gray-200">
                      <Link 
                        to={`/share/${share.share_id}`} 
                        className="hover:text-brand-purple flex items-center gap-2"
                      >
                        {share.title}
                        <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
                      </Link>
                    </td>
                    <td className="py-3.5 pr-3">
                      <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider text-gray-400 font-mono">
                        {share.language}
                      </span>
                    </td>
                    <td className="py-3.5 pr-3">
                      <span className="flex items-center gap-1.5 text-xs text-gray-300">
                        {share.visibility === 'public' && <Globe className="w-3.5 h-3.5 text-brand-purple" />}
                        {share.visibility === 'unlisted' && <EyeOff className="w-3.5 h-3.5 text-brand-teal" />}
                        {share.visibility === 'private' && <Lock className="w-3.5 h-3.5 text-rose-400" />}
                        <span className="capitalize">{share.visibility}</span>
                      </span>
                    </td>
                    <td className="py-3.5 pr-3 text-xs text-gray-400 font-mono">
                      {share.expires_at ? (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-500" />
                          {new Date(share.expires_at).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-gray-500">Never</span>
                      )}
                    </td>
                    <td className="py-3.5 text-center font-bold text-gray-300">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Eye className="w-3.5 h-3.5 text-gray-500" />
                        {share.views}
                      </span>
                    </td>
                    <td className="py-3.5 text-center font-bold text-gray-300">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <FolderGit2 className="w-3.5 h-3.5 text-gray-500" />
                        {share.forks}
                      </span>
                    </td>
                    <td className="py-3.5 text-center font-bold text-gray-300">
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                        {share.link_copies}
                      </span>
                    </td>
                    <td className="py-3.5 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleCopyLink(share.share_id)}
                        title="Copy Share Link"
                        className={`p-2 border rounded-xl transition ${
                          copiedId === share.share_id 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : 'bg-dark-900/60 border-white/5 hover:border-brand-purple/20 text-gray-400 hover:text-white'
                        }`}
                      >
                        {copiedId === share.share_id ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(share.share_id, share.title)}
                        title="Delete Share"
                        className="p-2 bg-dark-900/60 border border-white/5 hover:border-rose-500/20 rounded-xl text-gray-400 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
