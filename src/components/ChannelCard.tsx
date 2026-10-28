import React, { useState } from 'react';
import { ChannelItem, StreamCandidate } from '../types';
import {
  Play,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Trash2,
  Check
} from 'lucide-react';

interface ChannelCardProps {
  channel: ChannelItem;
  onPlay: (channel: ChannelItem) => void;
  onTestChannel: (channel: ChannelItem) => void;
  onSelectCandidate: (channelId: string, candidateIndex: number) => void;
  onRemoveCandidate: (channelId: string, candidateId: string) => void;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  onPlay,
  onTestChannel,
  onSelectCandidate,
  onRemoveCandidate
}) => {
  const [expanded, setExpanded] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const primaryCandidate: StreamCandidate =
    channel.candidates[channel.selectedUrlIndex] || channel.candidates[0];

  const overallStatus = primaryCandidate?.status || 'untested';

  return (
    <div
      className={`rounded-xl border bg-slate-900/70 p-4 transition duration-150 flex flex-col justify-between hover:border-slate-700 ${
        overallStatus === 'active'
          ? 'border-emerald-950/80 hover:border-emerald-800/60'
          : overallStatus === 'dead'
          ? 'border-red-950/80 hover:border-red-800/60'
          : 'border-slate-800'
      }`}
    >
      <div>
        {/* Top line: Logo, Name, Group Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3 overflow-hidden">
            {channel.logo && !logoFailed ? (
              <img
                src={channel.logo}
                alt={channel.name}
                onError={() => setLogoFailed(true)}
                className="w-10 h-10 rounded-lg object-contain bg-slate-950 p-1 border border-slate-800 flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 font-bold text-xs flex-shrink-0">
                {channel.name.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="overflow-hidden">
              <h3 className="font-bold text-slate-100 text-sm truncate" title={channel.name}>
                {channel.name}
              </h3>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="text-[11px] font-medium text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-full">
                  {channel.group}
                </span>
                {channel.candidates.length > 1 && (
                  <span className="text-[11px] font-mono text-slate-400 flex items-center space-x-1">
                    <Layers className="w-3 h-3 text-slate-500" />
                    <span>{channel.candidates.length} links</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Status Indicator Badge */}
          <div className="flex-shrink-0">
            {overallStatus === 'active' && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-[11px] font-mono font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>{primaryCandidate.latencyMs ? `${primaryCandidate.latencyMs}ms` : 'OK'}</span>
              </span>
            )}
            {overallStatus === 'dead' && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-red-950/80 text-red-400 border border-red-800 text-[11px] font-mono font-medium">
                <XCircle className="w-3 h-3 text-red-400" />
                <span>DEAD</span>
              </span>
            )}
            {overallStatus === 'testing' && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800 text-[11px] font-mono font-medium animate-pulse">
                <Activity className="w-3 h-3" />
                <span>TESTING</span>
              </span>
            )}
            {overallStatus === 'untested' && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700 text-[11px] font-mono">
                <Clock className="w-3 h-3" />
                <span>UNTESTED</span>
              </span>
            )}
          </div>
        </div>

        {/* Primary Stream URL Preview */}
        <div className="mt-3 bg-slate-950/60 rounded-lg p-2 border border-slate-850">
          <p className="text-[11px] font-mono text-slate-400 truncate select-all" title={primaryCandidate?.url}>
            {primaryCandidate?.url}
          </p>
          {primaryCandidate?.error && (
            <p className="text-[10px] text-red-400 font-mono mt-1 truncate">
              Err: {primaryCandidate.error}
            </p>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-3 pt-3 border-t border-slate-800/70 flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => onPlay(channel)}
            className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center space-x-1 transition"
            title="Preview stream in video player"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Play</span>
          </button>
          <button
            onClick={() => onTestChannel(channel)}
            disabled={overallStatus === 'testing'}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center space-x-1 transition disabled:opacity-50"
            title="Check stream health"
          >
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>Probe</span>
          </button>
        </div>

        {channel.candidates.length > 1 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1 font-mono transition"
          >
            <span>Backups ({channel.candidates.length})</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Expanded Candidate Stream Links */}
      {expanded && channel.candidates.length > 1 && (
        <div className="mt-3 pt-2 border-t border-slate-850 space-y-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
            Candidate Streams:
          </p>
          {channel.candidates.map((cand, idx) => {
            const isSelected = idx === channel.selectedUrlIndex;
            return (
              <div
                key={cand.id}
                className={`p-2 rounded-lg border text-xs font-mono flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-cyan-950/30 border-cyan-700/60'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="overflow-hidden flex-1">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-slate-300">#{idx + 1}</span>
                    {cand.status === 'active' && (
                      <span className="text-emerald-400 font-semibold text-[10px]">
                        OK ({cand.latencyMs}ms)
                      </span>
                    )}
                    {cand.status === 'dead' && (
                      <span className="text-red-400 font-semibold text-[10px]">DEAD</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{cand.url}</p>
                </div>

                <div className="flex items-center space-x-1 flex-shrink-0">
                  {!isSelected ? (
                    <button
                      onClick={() => onSelectCandidate(channel.id, idx)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                      title="Set as primary stream link"
                    >
                      Make Primary
                    </button>
                  ) : (
                    <span className="text-[10px] text-cyan-400 font-semibold flex items-center space-x-0.5">
                      <Check className="w-3 h-3" />
                      <span>Primary</span>
                    </span>
                  )}
                  <button
                    onClick={() => onRemoveCandidate(channel.id, cand.id)}
                    className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800"
                    title="Remove this stream candidate"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
