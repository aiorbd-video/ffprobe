import React from 'react';
import { CheckerStats } from '../types';
import { Tv, CheckCircle2, XCircle, Clock, Zap, Activity } from 'lucide-react';

interface StatsCardsProps {
  stats: CheckerStats;
  isChecking: boolean;
  progressPercent: number;
  checkedCount: number;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  stats,
  isChecking,
  progressPercent,
  checkedCount
}) => {
  return (
    <div className="space-y-3">
      {/* Progress Bar when active checking */}
      {isChecking && (
        <div className="bg-slate-900 border border-cyan-800/60 rounded-xl p-3 shadow-lg">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="flex items-center text-cyan-400 font-semibold space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>TESTING STREAMS IN PARALLEL...</span>
            </span>
            <span className="text-slate-300">
              {checkedCount} / {stats.totalUniqueChannels} channels ({progressPercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
            <div
              className="bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 h-full transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Grid of Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Channels */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Channels</span>
            <Tv className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-white tracking-tight">
              {stats.totalUniqueChannels.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              {stats.totalCandidateLinks.toLocaleString()} stream links
            </p>
          </div>
        </div>

        {/* Active Streams */}
        <div className="bg-slate-900/90 border border-emerald-900/40 rounded-xl p-3.5 flex flex-col justify-between hover:border-emerald-700/60 transition">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-medium">Working / OK</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">
              {stats.activeCount.toLocaleString()}
            </div>
            <p className="text-[11px] text-emerald-500/80 mt-0.5 font-mono">
              {stats.totalUniqueChannels > 0
                ? `${Math.round((stats.activeCount / stats.totalUniqueChannels) * 100)}% verified`
                : '0% verified'}
            </p>
          </div>
        </div>

        {/* Dead Links */}
        <div className="bg-slate-900/90 border border-red-900/40 rounded-xl p-3.5 flex flex-col justify-between hover:border-red-700/60 transition">
          <div className="flex items-center justify-between text-red-400">
            <span className="text-xs font-medium">Dead / Discarded</span>
            <XCircle className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-red-400 tracking-tight">
              {stats.deadCount.toLocaleString()}
            </div>
            <p className="text-[11px] text-red-500/80 mt-0.5 font-mono">
              Ready for removal
            </p>
          </div>
        </div>

        {/* Untested Channels */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-xs font-medium">Untested</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-300 tracking-tight">
              {stats.untestedCount.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              Pending health check
            </p>
          </div>
        </div>

        {/* Avg Latency */}
        <div className="col-span-2 sm:col-span-1 bg-slate-900/90 border border-cyan-900/40 rounded-xl p-3.5 flex flex-col justify-between hover:border-cyan-700/60 transition">
          <div className="flex items-center justify-between text-cyan-400">
            <span className="text-xs font-medium">Avg Latency</span>
            <Zap className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-cyan-300 tracking-tight">
              {stats.avgLatencyMs > 0 ? `${stats.avgLatencyMs} ms` : '—'}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono flex items-center space-x-1">
              <Activity className="w-3 h-3 text-cyan-400" />
              <span>Response speed</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
