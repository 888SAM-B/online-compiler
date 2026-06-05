import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Crown, Star, Award, Shield } from 'lucide-react';
import api from '../api';
import Loader from '../components/Loader';

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/challenges/leaderboard');
      setLeaderboard(res.data.leaderboard);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
      setError('Failed to fetch leaderboard. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank) => {
    switch (rank) {
      case 1: return <Crown className="w-6 h-6 text-yellow-400 fill-current animate-bounce" />;
      case 2: return <Medal className="w-6 h-6 text-slate-300 fill-current" />;
      case 3: return <Medal className="w-6 h-6 text-amber-600 fill-current" />;
      default: return <span className="font-bold text-gray-500 text-sm">#{rank}</span>;
    }
  };

  const getRankClass = (rank) => {
    switch (rank) {
      case 1: return 'border border-yellow-400/20 bg-yellow-400/5 hover:bg-yellow-400/10 shadow-lg shadow-yellow-400/5';
      case 2: return 'border border-slate-300/20 bg-slate-300/5 hover:bg-slate-300/10';
      case 3: return 'border border-amber-600/20 bg-amber-600/5 hover:bg-amber-600/10';
      default: return 'border border-white/5 hover:border-white/10 bg-dark-900/10 hover:bg-dark-900/30';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        
        {/* Header Title */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-400 animate-pulse" />
            Global Leaderboard
          </h1>
          <p className="text-gray-400 mt-1.5 text-sm">
            Top developers competing on points and successfully resolved challenges.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm font-semibold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-3xl p-10 bg-dark-950/20">
            <Shield className="w-12 h-12 text-gray-600 mb-3" />
            <h3 className="text-white font-bold text-lg">Leaderboard is empty</h3>
            <p className="text-gray-500 text-sm mt-1 text-center max-w-sm">
              Be the first user to submit a challenge and rank first on our coding platform!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {leaderboard.map((user, idx) => {
              const rank = idx + 1;
              return (
                <div
                  key={user.user_id}
                  className={`flex items-center justify-between px-6 py-4 rounded-3xl transition-all duration-300 ${getRankClass(rank)}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank Badge */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-dark-950/50 border border-white/5">
                      {getRankBadge(rank)}
                    </div>

                    {/* Name details */}
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        {user.username}
                        {rank === 1 && (
                          <span className="text-[10px] text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 font-extrabold uppercase px-2 py-0.5 rounded-md flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-current" />
                            Champ
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-gray-500 font-medium mt-0.5">{user.email}</p>
                    </div>
                  </div>

                  {/* Leaderboard stats */}
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Solved</p>
                      <p className="text-sm font-black text-white mt-0.5 flex items-center gap-1">
                        <Award className="w-4 h-4 text-brand-purple" />
                        {user.solved_challenges}
                      </p>
                    </div>
                    <div className="text-right min-w-[70px]">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Score</p>
                      <p className="text-sm font-black text-brand-purple mt-0.5">{user.total_score} pts</p>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
