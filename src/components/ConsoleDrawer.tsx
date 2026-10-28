import React, { useState, useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { Terminal, Copy, Trash2, Check, ArrowDown, ChevronDown, ChevronUp } from 'lucide-react';

interface ConsoleDrawerProps {
  logs: LogEntry[];
  onClearLogs: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const ConsoleDrawer: React.FC<ConsoleDrawerProps> = ({
  logs,
  onClearLogs,
  isOpen,
  onToggle
}) => {
  const [filter, setFilter] = useState<'all' | 'ok' | 'dead' | 'info'>('all');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'ok') return log.level === 'ok';
    if (filter === 'dead') return log.level === 'dead';
    if (filter === 'info') return log.level === 'info' || log.level === 'warning';
    return true;
  });

  useEffect(() => {
    if (autoScroll && isOpen) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll, isOpen]);

  const handleCopyLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800 backdrop-blur-lg transition-all duration-300 shadow-2xl ${
      isOpen ? 'h-72' : 'h-11'
    }`}>
      {/* Drawer Header Bar */}
      <div className="h-11 px-4 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 select-none">
        <div
          onClick={onToggle}
          className="flex items-center space-x-2.5 cursor-pointer text-slate-300 hover:text-white"
        >
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold font-mono tracking-wider">CHECKER LOGS ({logs.length})</span>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </div>

        {isOpen && (
          <div className="flex items-center space-x-2">
            {/* Filter buttons */}
            <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[11px] font-mono">
              <button
                onClick={() => setFilter('all')}
                className={`px-2 py-0.5 rounded transition ${
                  filter === 'all' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('ok')}
                className={`px-2 py-0.5 rounded transition ${
                  filter === 'ok' ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                OK
              </button>
              <button
                onClick={() => setFilter('dead')}
                className={`px-2 py-0.5 rounded transition ${
                  filter === 'dead' ? 'bg-red-500/20 text-red-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                DEAD
              </button>
              <button
                onClick={() => setFilter('info')}
                className={`px-2 py-0.5 rounded transition ${
                  filter === 'info' ? 'bg-blue-500/20 text-blue-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Info
              </button>
            </div>

            <div className="h-4 w-px bg-slate-800" />

            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`p-1.5 rounded hover:bg-slate-800 transition ${
                autoScroll ? 'text-cyan-400' : 'text-slate-500'
              }`}
              title={autoScroll ? 'Auto-scroll Enabled' : 'Auto-scroll Paused'}
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleCopyLogs}
              className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="Copy All Logs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={onClearLogs}
              className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
              title="Clear Console"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Log lines container */}
      {isOpen && (
        <div className="h-[calc(18rem-2.75rem)] overflow-y-auto p-3 font-mono text-[11px] leading-relaxed space-y-1 bg-black/50">
          {filteredLogs.length === 0 ? (
            <div className="text-slate-600 italic py-4 text-center">No logs recorded yet.</div>
          ) : (
            filteredLogs.map(log => {
              let color = 'text-slate-300';
              if (log.level === 'ok') color = 'text-emerald-400';
              if (log.level === 'dead') color = 'text-red-400';
              if (log.level === 'warning') color = 'text-amber-400';
              if (log.level === 'error') color = 'text-rose-500 font-bold';

              return (
                <div key={log.id} className="flex items-start space-x-2 hover:bg-slate-900/40 px-1 rounded">
                  <span className="text-slate-600 select-none">{log.timestamp}</span>
                  <span className={`font-medium ${color}`}>{log.message}</span>
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
};
