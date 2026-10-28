# M3U Dead Link Remover & IPTV Stream Health Checker

A high-performance React + TypeScript application for managing M3U/IPTV playlists, validating live stream health, deduplicating candidate stream URLs, separating VOD content, and exporting clean, working playlists.

## Core Features Preserved & Enhanced

- **M3U Standardization & Smart Engine**:
  - Automatically categorizes channels using country and genre classification (Bangladesh, India, Sports, News, Kids, Music, Religious, Others).
  - Smart VOD / Movies separation by URL extensions (`.mp4`, `.mkv`, etc.) and paths (`/vod/`, `/movie/`).
  - Channel name normalization, title casing, and `#EXTINF` metadata normalization (`group-title`, `tvg-logo`, `tvg-id`).
- **Parallel Stream Health Prober**:
  - Validates stream reachability, latency, status codes, and media content-types.
  - Multi-threaded testing with configurable concurrency (10 to 100 parallel workers).
  - Realistic User-Agent rotation (VLC, Kodi, Chrome, Safari).
- **Candidate Stream Deduplication**:
  - Groups alternative stream links under unified channel names.
  - Automatically selects the fastest, verified working stream candidate and prunes dead links.
- **Embedded Live Video Player**:
  - Integrated HLS.js video playback for instant preview of `.m3u8` and media streams.
  - Live stream diagnostics (latency, resolution, bitrate, audio/video codec).
- **Real-time Diagnostics Console**:
  - Live logging mimicking the Python terminal output with status-colored tags (`OK`, `DEAD`, `PROGRESS`).
- **Playlist Management & Export**:
  - Preloaded bundled playlists (`working.m3u`, `bangla-hindi-sports.m3u`, `russia.m3u`).
  - Remote M3U fetching, file uploading, and raw text parsing.
  - One-click export of clean `working.m3u` formatted playlists.

## Development

```bash
npm install
npm run dev
```

Built for Node.js 22 + React 19 + Vite + Tailwind CSS.
