import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { ChannelItem, StreamCandidate } from '../types';
import { X, Play, Pause, Volume2, VolumeX, Maximize2, AlertTriangle, CheckCircle2, Radio, ExternalLink } from 'lucide-react';

interface PlayerModalProps {
  channel: ChannelItem | null;
  onClose: () => void;
  onMarkStatus?: (channelId: string, candidateId: string, status: 'active' | 'dead') => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({ channel, onClose, onMarkStatus }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [streamInfo, setStreamInfo] = useState<{
    resolution?: string;
    bitrate?: string;
    levels?: number;
    engine?: string;
  }>({});

  const candidate: StreamCandidate | undefined = channel?.candidates[selectedCandidateIndex] || channel?.candidates[0];

  useEffect(() => {
    if (channel) {
      setSelectedCandidateIndex(channel.selectedUrlIndex || 0);
    }
  }, [channel]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !candidate?.url) return;

    setPlayerError(null);
    setIsLoading(true);
    setStreamInfo({});

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const streamUrl = candidate.url.split('|')[0];
    const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('/hls') || streamUrl.includes('live');

    if (Hls.isSupported() && isHls) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });
      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsLoading(false);
        setStreamInfo({
          levels: data.levels.length,
          engine: 'HLS.js Hardware Accelerated'
        });
        video.play().catch(() => {
          setIsPlaying(false);
        });
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        const level = hls.levels[data.level];
        if (level) {
          setStreamInfo(prev => ({
            ...prev,
            resolution: `${level.width}x${level.height}`,
            bitrate: `${Math.round(level.bitrate / 1000)} kbps`
          }));
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setIsLoading(false);
          let errText = 'Stream playback failed';
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              errText = 'Network Error (CORS or stream offline)';
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              errText = 'Media Codec decode error';
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
          setPlayerError(errText);
          if (channel && candidate && onMarkStatus) {
            onMarkStatus(channel.id, candidate.id, 'dead');
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl') || !isHls) {
      // Native video support
      video.src = streamUrl;
      video.onloadedmetadata = () => {
        setIsLoading(false);
        setStreamInfo({
          resolution: video.videoWidth ? `${video.videoWidth}x${video.videoHeight}` : 'Dynamic',
          engine: 'HTML5 Native Pipeline'
        });
        video.play().catch(() => setIsPlaying(false));
      };
      video.onerror = () => {
        setIsLoading(false);
        setPlayerError('Native playback failed (Codec unsupported or link dead)');
        if (channel && candidate && onMarkStatus) {
          onMarkStatus(channel.id, candidate.id, 'dead');
        }
      };
    } else {
      setIsLoading(false);
      setPlayerError('HLS playback is not supported on this browser engine');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [candidate?.url, channel, onMarkStatus]);

  if (!channel || !candidate) return null;

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/80 border-b border-slate-800">
          <div className="flex items-center space-x-3 overflow-hidden">
            {channel.logo ? (
              <img
                src={channel.logo}
                alt={channel.name}
                className="w-8 h-8 rounded-lg object-contain bg-slate-800 p-0.5 border border-slate-700"
                onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400 font-bold text-xs">
                {channel.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-100 text-base truncate">{channel.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 font-medium">
                  {channel.group}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md font-mono mt-0.5">
                {candidate.url}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Canvas Container */}
        <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs space-y-2">
              <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-cyan-300 font-mono tracking-wider">CONNECTING STREAM...</p>
            </div>
          )}

          {playerError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/85 p-6 text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-red-400 animate-pulse" />
              <h4 className="text-sm font-semibold text-red-200">{playerError}</h4>
              <p className="text-xs text-slate-300 max-w-md">
                This stream link may be geo-blocked, offline, or requiring specific token auth.
              </p>
              <div className="flex items-center space-x-3 pt-2">
                {channel.candidates.length > 1 && (
                  <button
                    onClick={() => {
                      const next = (selectedCandidateIndex + 1) % channel.candidates.length;
                      setSelectedCandidateIndex(next);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white border border-slate-600 transition"
                  >
                    Try Backup Link ({selectedCandidateIndex + 1}/{channel.candidates.length})
                  </button>
                )}
                <a
                  href={candidate.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-medium border border-cyan-500/40 flex items-center space-x-1.5 transition"
                >
                  <span>Open URL Directly</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Video Controls & Stream Diagnostics */}
        <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button
                onClick={togglePlay}
                className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold transition"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>
              <button
                onClick={toggleMute}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              <div className="h-5 w-px bg-slate-800 mx-1" />

              <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-medium">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span>LIVE</span>
              </span>
            </div>

            {/* Diagnostics Pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              {streamInfo.resolution && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {streamInfo.resolution}
                </span>
              )}
              {streamInfo.bitrate && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {streamInfo.bitrate}
                </span>
              )}
              {streamInfo.engine && (
                <span className="px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800">
                  {streamInfo.engine}
                </span>
              )}
            </div>
          </div>

          {/* Backup Links Selector if multiple */}
          {channel.candidates.length > 1 && (
            <div className="pt-2 border-t border-slate-850">
              <p className="text-xs text-slate-400 mb-1.5 font-medium flex items-center justify-between">
                <span>Available Stream Links ({channel.candidates.length}):</span>
                <span className="text-[11px] text-slate-500 font-mono">Select to switch source</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {channel.candidates.map((cand, idx) => {
                  const isCurrent = idx === selectedCandidateIndex;
                  return (
                    <button
                      key={cand.id}
                      onClick={() => setSelectedCandidateIndex(idx)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition flex items-center space-x-1.5 ${
                        isCurrent
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200'
                          : 'bg-slate-850 border-slate-700/80 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cand.status === 'active' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                      {cand.status === 'dead' && <AlertTriangle className="w-3 h-3 text-red-400" />}
                      <span>Link #{idx + 1}</span>
                      {cand.latencyMs && <span className="text-[10px] opacity-70">({cand.latencyMs}ms)</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
