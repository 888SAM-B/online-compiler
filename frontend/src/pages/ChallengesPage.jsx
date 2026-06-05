import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Search, 
  Clock, 
  CheckCircle2, 
  Award,
  Zap,
  HelpCircle
} from 'lucide-react';
import api from '../api';
import Loader from '../components/Loader';

const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];
const CATEGORIES = ['All', 'Arrays', 'Strings', 'Math', 'Loops', 'Recursion', 'Searching', 'Sorting'];
const LANGUAGES = [
  { id: 'all', name: 'All Languages' },
  { id: 'python', name: 'Python' },
  { id: 'javascript', name: 'JavaScript' },
  { id: 'c', name: 'C' },
  { id: 'cpp', name: 'C++' },
  { id: 'java', name: 'Java' }
];

export default function ChallengesPage() {
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState([]);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [activeLang, setActiveLang] = useState('all');
  const [activeDiff, setActiveDiff] = useState('All');
  const [activeCat, setActiveCat] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeLang, activeDiff, activeCat]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // Build query params
      const params = {};
      if (activeLang !== 'all') params.language = activeLang;
      if (activeDiff !== 'All') params.difficulty = activeDiff;
      if (activeCat !== 'All') params.category = activeCat;

      const [challengesRes, progressRes] = await Promise.all([
        api.get('/challenges', { params }),
        api.get('/challenges/progress')
      ]);

      setChallenges(challengesRes.data);
      setProgress(progressRes.data);
    } catch (err) {
      console.error('Failed to load challenges:', err);
      setError('Failed to fetch coding challenges. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Check if challenge is solved
  const isSolved = (challengeId) => {
    if (!progress || !progress.achievements) return false;
    // We can also determine solving by comparing challenge submissions, or by tracking solved challenge ids.
    // Wait, since `/challenges/progress` doesn't return the list of solved challenge IDs directly but we can fetch user submissions or check if there is an achievement.
    // Actually, let's fetch `/challenges/my-submissions` to know which challenges the user solved, or let's update progress payload to make it clean!
    // Wait, is it easier if we fetch submissions and keep a Set of solved challenge IDs? Yes!
    // Let's do that! Let's fetch my submissions and find unique challenge IDs with status == "PASSED".
  };

  const [solvedIds, setSolvedIds] = useState(new Set());
  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        const res = await api.get('/challenges/my-submissions');
        const solved = new Set(
          res.data
            .filter(sub => sub.status === 'PASSED')
            .map(sub => sub.challenge_id)
        );
        setSolvedIds(solved);
      } catch (err) {
        console.error('Failed to load submissions:', err);
      }
    };
    fetchSubmissions();
  }, []);

  const getDifficultyColor = (diff) => {
    switch (diff) {
      case 'Easy': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Medium': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Hard': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const filteredChallenges = challenges.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.problem_statement.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Zap className="w-8 h-8 text-brand-purple animate-pulse" />
              Coding Challenges
            </h1>
            <p className="text-gray-400 mt-1.5 text-sm">
              Practice problems, execute hidden test cases, earn points, and climb the leaderboard.
            </p>
          </div>
          {progress && (
            <div className="flex items-center gap-4 bg-dark-900/40 border border-white/5 rounded-2xl px-5 py-3 backdrop-blur-md">
              <div className="text-center">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Score</p>
                <p className="text-xl font-black text-brand-purple">{progress.total_score} pts</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Solved</p>
                <p className="text-xl font-black text-white">{progress.total_solved}</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Global Rank</p>
                <p className="text-xl font-black text-brand-green">#{progress.global_rank}</p>
              </div>
            </div>
          )}
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col gap-4 bg-dark-900/30 border border-white/5 rounded-3xl p-6 backdrop-blur-md">
          {/* Language Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/5">
            {LANGUAGES.map(lang => (
              <button
                key={lang.id}
                onClick={() => setActiveLang(lang.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeLang === lang.id
                    ? 'bg-brand-purple text-white shadow-lg shadow-brand-purple/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-dark-800'
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center gap-4 mt-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search challenges by title or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-dark-950 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-purple/50 focus:ring-1 focus:ring-brand-purple/50 transition-all"
              />
            </div>

            {/* Dropdowns */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Difficulty Selector */}
              <div className="flex items-center gap-1.5 bg-dark-950 border border-white/5 rounded-xl p-1">
                {DIFFICULTIES.map(diff => (
                  <button
                    key={diff}
                    onClick={() => setActiveDiff(diff)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                      activeDiff === diff
                        ? 'bg-brand-purple/20 text-brand-purple'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>

              {/* Category Selector */}
              <select
                value={activeCat}
                onChange={(e) => setActiveCat(e.target.value)}
                className="bg-dark-950 border border-white/5 text-gray-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-brand-purple/50"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat} Topic</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm font-semibold">
            {error}
          </div>
        )}

        {/* Challenges Grid */}
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader />
          </div>
        ) : filteredChallenges.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-3xl p-10 bg-dark-950/20">
            <BookOpen className="w-12 h-12 text-gray-600 mb-3" />
            <h3 className="text-white font-bold text-lg">No Challenges Found</h3>
            <p className="text-gray-500 text-sm mt-1 text-center max-w-sm">
              We couldn't find any challenges matching your current search parameters and filters. Try tweaking them.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredChallenges.map(challenge => (
              <div
                key={challenge.id}
                onClick={() => navigate(`/challenges/${challenge.id}`)}
                className="group relative flex flex-col justify-between bg-dark-900/20 border border-white/5 hover:border-brand-purple/20 rounded-3xl p-6 hover:shadow-2xl hover:shadow-brand-purple/5 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border ${getDifficultyColor(challenge.difficulty)}`}>
                      {challenge.difficulty}
                    </span>
                    {solvedIds.has(challenge.id) ? (
                      <span className="flex items-center gap-1 text-xs text-brand-green font-bold bg-brand-green/10 border border-brand-green/20 px-2 py-0.5 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Solved
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500 font-bold bg-dark-950 border border-white/5 px-2 py-0.5 rounded-lg">
                        Unsolved
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-brand-purple transition-colors line-clamp-1">
                    {challenge.title}
                  </h3>

                  <p className="text-gray-400 text-xs mt-2 line-clamp-3 leading-relaxed">
                    {challenge.problem_statement}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {challenge.tags.map((tag, idx) => (
                      <span key={idx} className="bg-dark-950 text-[10px] text-gray-500 font-semibold px-2 py-0.5 border border-white/5 rounded-md">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-6 border-t border-white/5 pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-gray-500">
                    <span className="flex items-center gap-1 text-[11px] font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {challenge.estimated_time_minutes}m
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-medium">
                      <Award className="w-3.5 h-3.5 text-brand-purple" />
                      {challenge.points} pts
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-500 font-bold">
                    {challenge.success_rate ? `${Math.round(challenge.success_rate)}% rate` : '0% rate'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
