export type StreamStatus = 'untested' | 'testing' | 'active' | 'dead';

export interface StreamCandidate {
  id: string;
  url: string;
  status: StreamStatus;
  latencyMs?: number;
  httpStatus?: number;
  contentType?: string;
  error?: string;
  codecType?: string;
  lastChecked?: number;
}

export interface ChannelItem {
  id: string;
  extinf: string;
  rawExtinf: string;
  name: string;
  normalizedName: string;
  group: string;
  logo?: string;
  candidates: StreamCandidate[];
  selectedUrlIndex: number; // Index of the chosen/primary working stream
  tvgId?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'ok' | 'dead' | 'warning' | 'error';
  message: string;
  group?: string;
  channel?: string;
}

export interface M3USourceConfig {
  id: string;
  name: string;
  url: string;
  type: 'bundled' | 'remote' | 'custom' | 'upload';
  isLocal?: boolean;
  localKey?: string;
  enabled?: boolean;
}

export interface CheckerStats {
  totalUniqueChannels: number;
  totalCandidateLinks: number;
  activeCount: number;
  deadCount: number;
  untestedCount: number;
  avgLatencyMs: number;
}
