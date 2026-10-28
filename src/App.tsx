import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChannelItem, StreamCandidate, LogEntry, CheckerStats } from './types';
import { parseM3U, serializeM3U } from './utils/m3uParser';
import { probeStream, ConcurrentQueue } from './services/streamChecker';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { FilterBar } from './components/FilterBar';
import { ChannelCard } from './components/ChannelCard';
import { PlayerModal } from './components/PlayerModal';
import { ConsoleDrawer } from './components/ConsoleDrawer';
import { SourcesModal } from './components/SourcesModal';
import { Tv, Sparkles, AlertCircle, RefreshCw, Layers } from 'lucide-react';

export const App: React.FC = () => {
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [activeSourceName, setActiveSourceName] = useState<string>('working.m3u (Bundled)');
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [checkedCount, setCheckedCount] = useState<number>(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);
  const [isSourcesModalOpen, setIsSourcesModalOpen] = useState<boolean>(false);
  const [playerChannel, setPlayerChannel] = useState<ChannelItem | null>(null);

  // Filters & Controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'dead' | 'untested'>('all');
  const [sortBy, setSortBy] = useState<'group' | 'name' | 'latency' | 'links'>('group');
  const [concurrency, setConcurrency] = useState<number>(50);
  const [visibleCount, setVisibleCount] = useState<number>(60);

  const abortControllerRef = useRef<AbortController | null>(null);
  const queueRef = useRef<ConcurrentQueue | null>(null);

  const addLog = useCallback((message: string, level: LogEntry['level'] = 'info', group?: string, channel?: string) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).slice(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      group,
      channel
    };
    setLogs(prev => [...prev.slice(-300), entry]);
  }, []);

  // Initial Load from working.m3u
  useEffect(() => {
    const loadDefault = async () => {
      addLog('🚀 Starting Pro M3U Checker with Ultimate VOD Separation & BD Channel Fix...', 'info');
      try {
        const resp = await fetch('/api/local-playlist?key=working');
        if (resp.ok) {
          const text = await resp.text();
          const parsed = parseM3U(text);
          setChannels(parsed);
          addLog(`✅ Loaded working.m3u: ${parsed.length} channels ready`, 'ok');
        } else {
          // If api not ready yet, retry once shortly
          setTimeout(async () => {
            try {
              const retryResp = await fetch('/api/local-playlist?key=working');
              if (retryResp.ok) {
                const text = await retryResp.text();
                const parsed = parseM3U(text);
                setChannels(parsed);
                addLog(`✅ Loaded working.m3u: ${parsed.length} channels ready`, 'ok');
              }
            } catch {
              addLog('⚠️ Could not auto-load working.m3u', 'warning');
            }
          }, 1000);
        }
      } catch (err: any) {
        addLog(`⚠️ Initial load note: ${err.message}`, 'warning');
      }
    };
    loadDefault();
  }, [addLog]);

  // Load from Bundled files
  const handleLoadBundled = async (key: 'working' | 'bangla' | 'russia', name: string) => {
    addLog(`⏳ Loading ${name}...`, 'info');
    const resp = await fetch(`/api/local-playlist?key=${key}`);
    if (!resp.ok) {
      throw new Error(`Failed to load ${name} (HTTP ${resp.status})`);
    }
    const text = await resp.text();
    const parsed = parseM3U(text);
    setChannels(parsed);
    setActiveSourceName(name);
    setVisibleCount(60);
    addLog(`✅ Successfully loaded ${parsed.length} channels from ${name}`, 'ok');
  };

  // Load from Remote URL
  const handleLoadRemote = async (url: string, name: string) => {
    addLog(`🌐 Fetching playlist from ${url}...`, 'info');
    const resp = await fetch(`/api/fetch-remote?url=${encodeURIComponent(url)}`);
    if (!resp.ok) {
      throw new Error(`Failed to fetch playlist (HTTP ${resp.status})`);
    }
    const text = await resp.text();
    const parsed = parseM3U(text);
    setChannels(parsed);
    setActiveSourceName(name);
    setVisibleCount(60);
    addLog(`✅ Successfully parsed ${parsed.length} channels from ${name}`, 'ok');
  };

  // Load from Upload / Raw text
  const handleLoadText = (content: string, name: string) => {
    addLog(`📄 Parsing uploaded playlist: ${name}...`, 'info');
    const parsed = parseM3U(content);
    setChannels(parsed);
    setActiveSourceName(name);
    setVisibleCount(60);
    addLog(`✅ Successfully loaded ${parsed.length} channels from ${name}`, 'ok');
  };

  // Single Channel Probe
  const handleTestChannel = async (channel: ChannelItem) => {
    // Mark channel testing
    setChannels(prev =>
      prev.map(c => {
        if (c.id === channel.id) {
          return {
            ...c,
            candidates: c.candidates.map(cand => ({ ...cand, status: 'testing' }))
          };
        }
        return c;
      })
    );

    addLog(`🔍 Testing channel [${channel.group}] ${channel.name}...`, 'info');

    let foundWorking = false;
    let chosenCandidateIndex = 0;
    const updatedCandidates: StreamCandidate[] = [];

    for (let i = 0; i < channel.candidates.length; i++) {
      const candidate = channel.candidates[i];
      const result = await probeStream(candidate.url);

      if (result.ok) {
        foundWorking = true;
        chosenCandidateIndex = i;
        updatedCandidates.push({
          ...candidate,
          status: 'active',
          latencyMs: result.latencyMs,
          httpStatus: result.status,
          contentType: result.contentType,
          codecType: result.codecType,
          lastChecked: Date.now()
        });
        addLog(
          `🟢 OK: [${channel.group}] ${channel.name} (Latency: ${result.latencyMs}ms, ${result.codecType || 'Stream'})`,
          'ok',
          channel.group,
          channel.name
        );
        break; // Stop after first working stream (matching auto_m3u.py process_channel_group)
      } else {
        updatedCandidates.push({
          ...candidate,
          status: 'dead',
          latencyMs: result.latencyMs,
          httpStatus: result.status,
          error: result.error || 'Connection failed',
          lastChecked: Date.now()
        });
      }
    }

    if (!foundWorking) {
      addLog(`🔴 DEAD: [${channel.group}] ${channel.name} (All links failed)`, 'dead', channel.group, channel.name);
    }

    setChannels(prev =>
      prev.map(c => {
        if (c.id === channel.id) {
          return {
            ...c,
            selectedUrlIndex: chosenCandidateIndex,
            candidates: updatedCandidates
          };
        }
        return c;
      })
    );
  };

  // Run Batch Check
  const handleToggleBatchChecking = async () => {
    if (isChecking) {
      // Abort
      abortControllerRef.current?.abort();
      queueRef.current?.abort();
      setIsChecking(false);
      addLog('⏹️ Health check stopped by user', 'warning');
      return;
    }

    setIsChecking(true);
    setCheckedCount(0);
    setIsConsoleOpen(true);
    addLog(`🚀 Starting Batch Health Check on ${channels.length} channels with ${concurrency} threads...`, 'info');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const queue = new ConcurrentQueue(concurrency);
    queueRef.current = queue;

    let checkedSoFar = 0;
    let okFound = 0;
    let deadFound = 0;

    const tasks = channels.map(channel => async () => {
      if (controller.signal.aborted) return;

      // Mark testing
      setChannels(prev =>
        prev.map(c => (c.id === channel.id ? { ...c, candidates: c.candidates.map(k => ({ ...k, status: 'testing' })) } : c))
      );

      let foundWorking = false;
      let workingIndex = 0;
      const updatedCandidates: StreamCandidate[] = [];

      for (let i = 0; i < channel.candidates.length; i++) {
        if (controller.signal.aborted) break;
        const cand = channel.candidates[i];
        const res = await probeStream(cand.url, controller.signal);

        if (res.ok) {
          foundWorking = true;
          workingIndex = i;
          updatedCandidates.push({
            ...cand,
            status: 'active',
            latencyMs: res.latencyMs,
            httpStatus: res.status,
            contentType: res.contentType,
            codecType: res.codecType,
            lastChecked: Date.now()
          });
          okFound++;
          addLog(
            `🟢 OK: [${channel.group}] ${channel.name} (Selected link #${i + 1}, ${res.latencyMs}ms)`,
            'ok',
            channel.group,
            channel.name
          );
          break; // Found working stream
        } else {
          updatedCandidates.push({
            ...cand,
            status: 'dead',
            latencyMs: res.latencyMs,
            httpStatus: res.status,
            error: res.error || 'Failed',
            lastChecked: Date.now()
          });
        }
      }

      if (!foundWorking && !controller.signal.aborted) {
        deadFound++;
        addLog(`🔴 DEAD: [${channel.group}] ${channel.name} (All links failed)`, 'dead', channel.group, channel.name);
      }

      setChannels(prev =>
        prev.map(c => {
          if (c.id === channel.id) {
            return {
              ...c,
              selectedUrlIndex: workingIndex,
              candidates: updatedCandidates.length > 0 ? updatedCandidates : c.candidates
            };
          }
          return c;
        })
      );

      checkedSoFar++;
      setCheckedCount(checkedSoFar);
    });

    try {
      await Promise.all(tasks.map(t => queue.enqueue(t)));
      addLog(`🎉 Done! Tested ${checkedSoFar} channels | Working: ${okFound} | Dead: ${deadFound}`, 'ok');
    } catch {
      // ignore abort
    } finally {
      setIsChecking(false);
    }
  };

  // Remove Dead Links
  const handleRemoveDeadLinks = () => {
    let removedChannels = 0;
    let prunedLinks = 0;

    const cleaned = channels
      .map(ch => {
        const remainingCandidates = ch.candidates.filter(c => c.status !== 'dead');
        prunedLinks += ch.candidates.length - remainingCandidates.length;

        if (remainingCandidates.length === 0) {
          removedChannels++;
          return null;
        }

        return {
          ...ch,
          candidates: remainingCandidates,
          selectedUrlIndex: 0
        };
      })
      .filter((ch): ch is ChannelItem => ch !== null);

    setChannels(cleaned);
    addLog(`🧹 Cleaned: Removed ${removedChannels} dead channels and pruned ${prunedLinks} dead links`, 'ok');
  };

  // Export M3U
  const handleExportM3U = (onlyActive: boolean) => {
    addLog(`💾 Generating & downloading ${onlyActive ? 'verified active' : 'entire'} working.m3u...`, 'info');
    const content = serializeM3U(channels, { onlyActive });
    const blob = new Blob([content], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = onlyActive ? 'working_verified.m3u' : 'working.m3u';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLog(`✅ Export complete: ${link.download}`, 'ok');
  };

  // Copy M3U
  const handleCopyM3U = () => {
    const content = serializeM3U(channels, { onlyActive: false });
    navigator.clipboard.writeText(content);
    addLog('📋 M3U playlist copied to clipboard', 'ok');
  };

  // Select candidate stream
  const handleSelectCandidate = (channelId: string, candidateIndex: number) => {
    setChannels(prev =>
      prev.map(c => (c.id === channelId ? { ...c, selectedUrlIndex: candidateIndex } : c))
    );
  };

  // Remove candidate stream
  const handleRemoveCandidate = (channelId: string, candidateId: string) => {
    setChannels(prev =>
      prev.map(c => {
        if (c.id === channelId) {
          const remaining = c.candidates.filter(k => k.id !== candidateId);
          return {
            ...c,
            candidates: remaining,
            selectedUrlIndex: Math.min(c.selectedUrlIndex, Math.max(0, remaining.length - 1))
          };
        }
        return c;
      })
    );
  };

  // Calculate Statistics
  const stats: CheckerStats = useMemo(() => {
    let totalCandidates = 0;
    let activeCount = 0;
    let deadCount = 0;
    let untestedCount = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    for (const ch of channels) {
      totalCandidates += ch.candidates.length;
      const primary = ch.candidates[ch.selectedUrlIndex] || ch.candidates[0];
      if (primary) {
        if (primary.status === 'active') {
          activeCount++;
          if (primary.latencyMs) {
            totalLatency += primary.latencyMs;
            latencyCount++;
          }
        } else if (primary.status === 'dead') {
          deadCount++;
        } else {
          untestedCount++;
        }
      }
    }

    return {
      totalUniqueChannels: channels.length,
      totalCandidateLinks: totalCandidates,
      activeCount,
      deadCount,
      untestedCount,
      avgLatencyMs: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0
    };
  }, [channels]);

  // Compute Categories with count
  const categoriesWithCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const ch of channels) {
      map[ch.group] = (map[ch.group] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [channels]);

  // Filtered & Sorted Channels
  const filteredChannels = useMemo(() => {
    let result = channels.filter(ch => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = ch.name.toLowerCase().includes(q);
        const matchesGroup = ch.group.toLowerCase().includes(q);
        const matchesUrl = ch.candidates.some(c => c.url.toLowerCase().includes(q));
        if (!matchesName && !matchesGroup && !matchesUrl) return false;
      }

      // Category
      if (selectedCategory !== 'all' && ch.group !== selectedCategory) {
        return false;
      }

      // Status
      const primary = ch.candidates[ch.selectedUrlIndex] || ch.candidates[0];
      const status = primary?.status || 'untested';
      if (statusFilter === 'active' && status !== 'active') return false;
      if (statusFilter === 'dead' && status !== 'dead') return false;
      if (statusFilter === 'untested' && status !== 'untested') return false;

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'group') {
        if (a.group !== b.group) return a.group.localeCompare(b.group);
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'latency') {
        const latA = a.candidates[a.selectedUrlIndex]?.latencyMs ?? 99999;
        const latB = b.candidates[b.selectedUrlIndex]?.latencyMs ?? 99999;
        return latA - latB;
      }
      if (sortBy === 'links') {
        return b.candidates.length - a.candidates.length;
      }
      return 0;
    });

    return result;
  }, [channels, searchQuery, selectedCategory, statusFilter, sortBy]);

  const displayedChannels = useMemo(() => {
    return filteredChannels.slice(0, visibleCount);
  }, [filteredChannels, visibleCount]);

  const progressPercent = channels.length > 0 ? Math.round((checkedCount / channels.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-16">
      {/* Top Header */}
      <Header
        activeSourceName={activeSourceName}
        isChecking={isChecking}
        onToggleChecking={handleToggleBatchChecking}
        onRemoveDeadLinks={handleRemoveDeadLinks}
        onExportM3U={handleExportM3U}
        onCopyM3U={handleCopyM3U}
        onOpenSources={() => setIsSourcesModalOpen(true)}
        onToggleConsole={() => setIsConsoleOpen(!isConsoleOpen)}
        isConsoleOpen={isConsoleOpen}
        deadCount={stats.deadCount}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1 w-full">
        {/* Metric Cards */}
        <StatsCards
          stats={stats}
          isChecking={isChecking}
          progressPercent={progressPercent}
          checkedCount={checkedCount}
        />

        {/* Filter and Search Bar */}
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          categories={categoriesWithCount}
          sortBy={sortBy}
          onSortChange={setSortBy}
          concurrency={concurrency}
          onConcurrencyChange={setConcurrency}
          totalFiltered={filteredChannels.length}
        />

        {/* Channels Grid */}
        {displayedChannels.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
            <Tv className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-semibold text-slate-300">No channels match your filter criteria</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search query, selecting another category, or changing the status filter.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setStatusFilter('all');
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 border border-slate-700 transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {displayedChannels.map(channel => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  onPlay={setPlayerChannel}
                  onTestChannel={handleTestChannel}
                  onSelectCandidate={handleSelectCandidate}
                  onRemoveCandidate={handleRemoveCandidate}
                />
              ))}
            </div>

            {/* Load More Pagination */}
            {visibleCount < filteredChannels.length && (
              <div className="pt-4 pb-2 text-center">
                <button
                  onClick={() => setVisibleCount(prev => prev + 60)}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition shadow-sm"
                >
                  Load More ({displayedChannels.length} of {filteredChannels.length} Channels)
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Video Player Modal */}
      {playerChannel && (
        <PlayerModal
          channel={playerChannel}
          onClose={() => setPlayerChannel(null)}
          onMarkStatus={(channelId, candidateId, status) => {
            setChannels(prev =>
              prev.map(c => {
                if (c.id === channelId) {
                  return {
                    ...c,
                    candidates: c.candidates.map(k => (k.id === candidateId ? { ...k, status } : k))
                  };
                }
                return c;
              })
            );
          }}
        />
      )}

      {/* Sources Selector Modal */}
      <SourcesModal
        isOpen={isSourcesModalOpen}
        onClose={() => setIsSourcesModalOpen(false)}
        onLoadBundled={handleLoadBundled}
        onLoadRemote={handleLoadRemote}
        onLoadText={handleLoadText}
        activeSourceName={activeSourceName}
      />

      {/* Real-time Diagnostics Terminal Console */}
      <ConsoleDrawer
        logs={logs}
        onClearLogs={() => setLogs([])}
        isOpen={isConsoleOpen}
        onToggle={() => setIsConsoleOpen(!isConsoleOpen)}
      />
    </div>
  );
};
export default App;
