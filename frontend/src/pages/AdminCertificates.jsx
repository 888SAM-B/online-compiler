import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Award, 
  Search, 
  Calendar, 
  Download, 
  ExternalLink, 
  ChevronLeft,
  Filter,
  ArrowUpDown,
  Mail,
  User,
  Hash,
  Trophy,
  Activity
} from 'lucide-react';
import api from '../api';
import Loader from '../components/Loader';
import { useToast } from '../context/ToastContext';

export default function AdminCertificates() {
  const toast = useToast();
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search & Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBadge, setSelectedBadge] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, highest_percentage, lowest_percentage

  useEffect(() => {
    fetchCertificates();
  }, []);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/assessments/certificates');
      setCertificates(res.data);
    } catch (err) {
      console.error('Failed to retrieve certificates:', err);
      toast.error('Failed to retrieve certificates list.');
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

  // Get unique certificate types (assessment titles)
  const uniqueTypes = ['all', ...new Set(certificates.map(c => c.assessment_title))];

  // Filtered and Sorted list
  const filteredCertificates = certificates
    .filter(cert => {
      // 1. Search Query (Certificate ID / email / user name)
      const query = searchQuery.toLowerCase().trim();
      const matchSearch = !query || 
        cert.certificate_id.toLowerCase().includes(query) ||
        cert.user_email.toLowerCase().includes(query) ||
        cert.user_name.toLowerCase().includes(query);

      // 2. Badge Filter
      const matchBadge = selectedBadge === 'all' || cert.badge?.toLowerCase() === selectedBadge.toLowerCase();

      // 3. Certificate Type Filter
      const matchType = selectedType === 'all' || cert.assessment_title === selectedType;

      return matchSearch && matchBadge && matchType;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.issued_at) - new Date(a.issued_at);
      }
      if (sortBy === 'oldest') {
        return new Date(a.issued_at) - new Date(b.issued_at);
      }
      if (sortBy === 'highest_percentage') {
        return b.percentage - a.percentage;
      }
      if (sortBy === 'lowest_percentage') {
        return a.percentage - b.percentage;
      }
      return 0;
    });

  // Calculate statistics
  const totalCertificates = certificates.length;
  const goldCount = certificates.filter(c => c.badge?.toLowerCase() === 'gold').length;
  const silverCount = certificates.filter(c => c.badge?.toLowerCase() === 'silver').length;
  const bronzeCount = certificates.filter(c => c.badge?.toLowerCase() === 'bronze').length;

  if (loading) {
    return <Loader fullScreen={true} />;
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 text-left bg-dark-950">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <Link
            to="/admin"
            className="p-2 hover:bg-dark-800 rounded-xl border border-white/5 text-gray-400 hover:text-white transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Manage Certificates</h1>
            <p className="text-sm text-gray-400 mt-1">
              Search, filter, view and verify student achievements and certificates globally.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-purple/10 text-brand-purple flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Certificates</p>
            <h3 className="text-2xl font-black text-white mt-0.5">{totalCertificates}</h3>
          </div>
        </div>

        <div className="glass p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Gold Badges</p>
            <h3 className="text-2xl font-black text-white mt-0.5">{goldCount}</h3>
          </div>
        </div>

        <div className="glass p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-300/10 text-gray-300 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Silver Badges</p>
            <h3 className="text-2xl font-black text-white mt-0.5">{silverCount}</h3>
          </div>
        </div>

        <div className="glass p-5 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Bronze Badges</p>
            <h3 className="text-2xl font-black text-white mt-0.5">{bronzeCount}</h3>
          </div>
        </div>
      </div>

      {/* Filters & Search controls */}
      <div className="glass p-5 rounded-2xl mb-8 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          
          {/* Search bar */}
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search by certificate ID, user name, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-950 border border-white/5 hover:border-white/10 focus:border-brand-purple/40 text-xs font-semibold text-white placeholder-gray-500 outline-none transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Filter by Certificate Type */}
            <div className="flex items-center gap-2 bg-dark-950 px-3 py-1.5 rounded-xl border border-white/5">
              <Filter className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-300 outline-none cursor-pointer"
              >
                <option value="all" className="bg-dark-950">All Exams</option>
                {uniqueTypes.filter(t => t !== 'all').map(t => (
                  <option key={t} value={t} className="bg-dark-950">{t}</option>
                ))}
              </select>
            </div>

            {/* Filter by Badge */}
            <div className="flex items-center gap-2 bg-dark-950 px-3 py-1.5 rounded-xl border border-white/5">
              <Trophy className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={selectedBadge}
                onChange={(e) => setSelectedBadge(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-300 outline-none cursor-pointer"
              >
                <option value="all" className="bg-dark-950">All Badges</option>
                <option value="gold" className="bg-dark-950 text-amber-400">Gold</option>
                <option value="silver" className="bg-dark-950 text-gray-300">Silver</option>
                <option value="bronze" className="bg-dark-950 text-orange-400">Bronze</option>
              </select>
            </div>

            {/* Sort by */}
            <div className="flex items-center gap-2 bg-dark-950 px-3 py-1.5 rounded-xl border border-white/5">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-300 outline-none cursor-pointer"
              >
                <option value="newest" className="bg-dark-950">Newest First</option>
                <option value="oldest" className="bg-dark-950">Oldest First</option>
                <option value="highest_percentage" className="bg-dark-950">Highest Score</option>
                <option value="lowest_percentage" className="bg-dark-950">Lowest Score</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Certificates Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {filteredCertificates.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No certificates found matching your search options.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-dark-900/40 text-[10px] uppercase font-bold tracking-widest text-gray-500">
                  <th className="py-4 px-6">Certificate ID</th>
                  <th className="py-4 px-6">User / Developer</th>
                  <th className="py-4 px-6">Exam Module</th>
                  <th className="py-4 px-6">Score</th>
                  <th className="py-4 px-6">Badge</th>
                  <th className="py-4 px-6">Issued Date</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                {filteredCertificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-white/5 transition-colors">
                    
                    {/* Certificate ID */}
                    <td className="py-4 px-6 font-mono font-bold text-white flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5 text-brand-purple" />
                      {cert.certificate_id}
                    </td>

                    {/* User */}
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white flex items-center gap-1">
                          <User className="w-3 h-3 text-gray-500" /> {cert.user_name}
                        </span>
                        <span className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-gray-600" /> {cert.user_email}
                        </span>
                      </div>
                    </td>

                    {/* Assessment Title */}
                    <td className="py-4 px-6 font-medium text-gray-200">
                      {cert.assessment_title}
                    </td>

                    {/* Score */}
                    <td className="py-4 px-6 font-mono font-bold text-emerald-400">
                      {cert.percentage}%
                    </td>

                    {/* Badge */}
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-extrabold uppercase border ${getBadgeColor(cert.badge)}`}>
                        {cert.badge}
                      </span>
                    </td>

                    {/* Issued Date */}
                    <td className="py-4 px-6 text-gray-500 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-600" />
                        {new Date(cert.issued_at).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/verify-certificate/${cert.certificate_id}`)}
                          className="p-2 bg-dark-900 border border-white/5 hover:border-brand-purple/20 text-gray-400 hover:text-white rounded-lg transition"
                          title="Verify Certificate"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <a
                          href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/assessments/certificates/${cert.certificate_id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-dark-900 border border-white/5 hover:border-white/10 text-gray-400 hover:text-white rounded-lg transition"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
