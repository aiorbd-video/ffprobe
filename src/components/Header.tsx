import React, { useState } from 'react';
import {
  Play,
  Square,
  Trash2,
  Download,
  Copy,
  Check,
  Terminal,
  FolderOpen,
  Filter,
  Tv,
  CheckCheck
} from 'lucide-react';

interface HeaderProps {
  activeSourceName: string;
  isChecking: boolean;
  onToggleChecking: () => void;
  onRemoveDeadLinks: () => void;
  onExportM3U: (onlyActive: boolean) => void;
  onCopyM3U: () => void;
  onOpenSources: () => void;
  onToggleConsole: () => void;
  isConsoleOpen: boolean;
  deadCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeSourceName,
  isChecking,
  onToggleChecking,
  onRemoveDeadLinks,
  onExportM3U,
  onCopyM3U,
  onOpenSources,
  onToggleConsole,
  isConsoleOpen,
  deadCount
}) => {
  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleCopy = () => {
    onCopyM3U();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-950/90 border-b border-slate-800 backdrop-blur-md px-4 sm:px-6 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & Active Source */}
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-slate-950">
            <Tv className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                M3U Dead Link Remover
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 font-semibold">
                PRO ENGINE
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
              <span>Source:</span>
              <button
                onClick={onOpenSources}
                className="font-mono text-cyan-300 hover:text-cyan-200 underline flex items-center space-x-1"
                title="Change M3U Source"
              >
                <span>{activeSourceName}</span>
                <FolderOpen className="w-3 h-3 ml-0.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Change source button */}
          <button
            onClick={onOpenSources}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition"
          >
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Load Playlist</span>
          </button>

          {/* Batch check toggle */}
          <button
            onClick={onToggleChecking}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition shadow-sm ${
              isChecking
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 animate-pulse'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
            }`}
          >
            {isChecking ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Check</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Health Check</span>
              </>
            )}
          </button>

          {/* Remove dead links */}
          <button
            onClick={onRemoveDeadLinks}
            disabled={deadCount === 0}
            className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 text-red-200 border border-red-800 text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
            title={deadCount > 0 ? `Remove ${deadCount} dead links` : 'No dead links detected yet'}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>Clean Dead ({deadCount})</span>
          </button>

          {/* Export Working M3U Menu */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800 text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export working.m3u</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 z-50 text-xs">
                <button
                  onClick={() => {
                    onExportM3U(true);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 flex flex-col"
                >
                  <span className="font-semibold text-emerald-300">Only Verified Working</span>
                  <span className="text-[11px] text-slate-400 font-mono">Excludes dead & untested streams</span>
                </button>
                <button
                  onClick={() => {
                    onExportM3U(false);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 flex flex-col mt-0.5"
                >
                  <span className="font-semibold text-slate-200">Entire Cleaned Playlist</span>
                  <span className="text-[11px] text-slate-400 font-mono">All standardized channels</span>
                </button>
              </div>
            )}
          </div>

          {/* Copy to clipboard */}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
            title="Copy M3U to Clipboard"
          >
            {copied ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* Console Drawer Toggle */}
          <button
            onClick={onToggleConsole}
            className={`p-1.5 rounded-lg border transition ${
              isConsoleOpen
                ? 'bg-cyan-950 border-cyan-800 text-cyan-300'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-800'
            }`}
            title="Toggle Live Console Logs"
          >
            <Terminal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
