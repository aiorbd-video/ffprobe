import { ChannelItem, StreamCandidate } from '../types';

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'VLC/3.0.20 LibVLC/3.0.20',
  'Kodi/20.3 (Windows NT 10.0; Win64; x64) App_Bitness/64 Version/20.3-Nexus'
];

export function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function cleanCanonicalName(rawName: string): string {
  let name = rawName.trim();

  // Strip url-like junk
  if (name.startsWith('#http') || name.startsWith('http')) {
    const parts = name.split('/');
    name = parts[parts.length - 1].replace('.m3u8', '').replace(/-/g, ' ');
  }

  // Strip leading digits or prefixes like 8NTV -> NTV, BD: -> ''
  name = name.replace(/^\d+([A-Za-z])/, '$1');
  name = name.replace(/^(BD|IN|UK|US|HINDI|BANGLA)[\s:\-_|]+/i, '');

  // Strip noise patterns
  const noisePatterns = [
    /\[backup\s*\d*\]/gi, /\(backup\s*\d*\)/gi, /\bbackup\s*\d*\b/gi,
    /\[\s*\d+p\s*\]/gi, /\(\s*\d+p\s*\)/gi, /\b\d{3,4}p\b/gi,
    /\[\s*fhd\s*\]/gi, /\(fhd\)/gi, /\bfhd\b/gi,
    /\[\s*uhd\s*\]/gi, /\(uhd\)/gi, /\buhd\b/gi,
    /\[\s*4k\s*\]/gi, /\(4k\)/gi, /\b4k\b/gi,
    /\[\s*hd\s*\]/gi, /\(hd\)/gi, /\bhd\b/gi,
    /\[\s*sd\s*\]/gi, /\(sd\)/gi, /\bsd\b/gi,
    /\[\s*hevc\s*\]/gi, /\(hevc\)/gi, /\bhevc\b/gi,
    /\(org\)/gi, /\[org\]/gi, /\(low\)/gi, /\(high\)/gi,
    /\|\s*vip\s*\|/gi, /\|\s*premium\s*\|/gi, /-\s*live\s*/gi,
    /server\s*\d+/gi, /stream\s*\d+/gi
  ];

  for (const pattern of noisePatterns) {
    name = name.replace(pattern, '');
  }

  name = name.replace(/[\s\-_|]+/g, ' ').trim();
  return name ? toTitleCase(name) : 'Unknown Channel';
}

export function standardizeData(line: string, url: string): {
  extinfClean: string;
  group: string;
  channelName: string;
  canonicalName: string;
  logo?: string;
  tvgId?: string;
} {
  const commaIdx = line.indexOf(',');
  const headerPart = commaIdx !== -1 ? line.slice(0, commaIdx) : line;
  const rawChannelName = commaIdx !== -1 ? line.slice(commaIdx + 1).trim() : 'Unknown Channel';
  const canonicalName = cleanCanonicalName(rawChannelName);
  const channelNameLower = canonicalName.toLowerCase();

  const groupMatch = line.match(/group-title="([^"]+)"/i);
  const originalGroup = groupMatch ? groupMatch[1].trim() : 'Others';
  const groupLower = originalGroup.toLowerCase();

  let cleanGroup = toTitleCase(originalGroup);

  // URL Analysis
  const urlLower = url.toLowerCase();
  let urlPath = '';
  let urlHost = '';
  try {
    const parsed = new URL(urlLower);
    urlPath = parsed.pathname;
    urlHost = parsed.hostname || '';
  } catch {
    urlPath = urlLower;
  }

  // 1. VOD (Video On Demand) Checker
  const vodExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.flv'];
  const isVodLink =
    vodExtensions.some(ext => urlPath.endsWith(ext)) ||
    urlLower.includes('://vod') ||
    urlHost.includes('vod.') ||
    urlHost.includes('vods.') ||
    urlPath.includes('/vod/') ||
    urlPath.includes('/vods/') ||
    urlPath.includes('/movie/') ||
    urlPath.includes('/series/');

  const isVodGroup = groupLower.includes('vod') || (groupLower.includes('movie') && !urlPath.endsWith('.m3u8'));

  if (isVodLink || isVodGroup) {
    cleanGroup = 'VOD / Movies';
  }
  // 2. Force Bangladeshi Channels
  else if (
    [
      'somoy', 'jamuna', 'ekattor', 'ntv', 'atn', 'gtv', 'gazi tv',
      'nagorik', 'boishakhi', 'channel i', 'dbc', 'independent',
      'rtv', 'btv', 'banglavision', 'deepto', 'dipto', 'maasranga',
      'mohona', 'my tv', 'desh tv', 'asian tv', 'ekushey', 't sports', 'toffee'
    ].some(x => channelNameLower.includes(x))
  ) {
    cleanGroup = 'Bangladesh';
  }
  // 3. Force Indian Channels
  else if (
    [
      'star ', 'zee ', 'colors', 'sony ', 'sun ', 'asianet',
      'abp ', 'ndtv', 'republic', 'aaj tak', 'sports18', 'jio ', 'jalsha', 'dd sports'
    ].some(x => channelNameLower.includes(x))
  ) {
    cleanGroup = 'India';
  }
  // 4. General Category Normalization
  else {
    if (['bangladesh', 'bangladeshi', 'bangla', 'bd'].some(x => groupLower.includes(x))) {
      cleanGroup = 'Bangladesh';
    } else if (['india', 'indian', 'hindi', 'in'].some(x => groupLower.includes(x))) {
      cleanGroup = 'India';
    } else if (['sports', 'sport', 'cricket', 'football', 'khela'].some(x => groupLower.includes(x))) {
      cleanGroup = 'Sports';
    } else if (['news', 'khobor', 'newz'].some(x => groupLower.includes(x))) {
      cleanGroup = 'News';
    } else if (['kids', 'cartoon', 'children'].some(x => groupLower.includes(x))) {
      cleanGroup = 'Kids';
    } else if (['music', 'song', 'gaan'].some(x => groupLower.includes(x))) {
      cleanGroup = 'Music';
    } else if (['religious', 'islamic', 'quran', 'islam'].some(x => groupLower.includes(x))) {
      cleanGroup = 'Religious';
    } else if (originalGroup.toLowerCase() === 'others') {
      cleanGroup = 'Others';
    } else {
      cleanGroup = toTitleCase(originalGroup);
    }
  }

  // Update group-title and canonicalize channel name in header
  let updatedHeader = headerPart;
  if (groupMatch) {
    updatedHeader = headerPart.replace(`group-title="${originalGroup}"`, `group-title="${cleanGroup}"`);
  } else {
    updatedHeader = `${headerPart} group-title="${cleanGroup}"`;
  }

  const extinfClean = `${updatedHeader},${canonicalName}`;

  // Extract logo
  const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
  const logo = logoMatch ? logoMatch[1].trim() : undefined;

  // Extract tvg-id
  const tvgIdMatch = line.match(/tvg-id="([^"]+)"/i);
  const tvgId = tvgIdMatch ? tvgIdMatch[1].trim() : undefined;

  return {
    extinfClean,
    group: cleanGroup,
    channelName: rawChannelName,
    canonicalName,
    logo,
    tvgId
  };
}

export function parseM3U(content: string): ChannelItem[] {
  const lines = content.split(/\r?\n/);
  const channelsMap: Map<string, ChannelItem> = new Map();
  const globalSeenUrls = new Set<string>();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF')) {
      if (i + 1 < lines.length) {
        const rawUrl = lines[i + 1].trim();
        if (rawUrl && !rawUrl.startsWith('#') && rawUrl.startsWith('http')) {
          const cleanStreamUrl = rawUrl.split('|')[0].trim();

          // Strict Cross-Channel Global URL Deduplication
          if (globalSeenUrls.has(cleanStreamUrl)) {
            i += 2;
            continue;
          }
          globalSeenUrls.add(cleanStreamUrl);

          const { extinfClean, group, canonicalName, logo, tvgId } = standardizeData(line, rawUrl);

          const candidate: StreamCandidate = {
            id: `cand-${Math.random().toString(36).slice(2, 9)}`,
            url: rawUrl,
            status: 'untested'
          };

          const existing = channelsMap.get(canonicalName);
          if (existing) {
            existing.candidates.push(candidate);
            if (!existing.logo && logo) {
              existing.logo = logo;
            }
          } else {
            channelsMap.set(canonicalName, {
              id: `ch-${Math.random().toString(36).slice(2, 9)}`,
              extinf: extinfClean,
              rawExtinf: line,
              name: canonicalName,
              normalizedName: canonicalName,
              group,
              logo,
              tvgId,
              candidates: [candidate],
              selectedUrlIndex: 0
            });
          }
        }
      }
      i += 2;
    } else {
      i += 1;
    }
  }

  return Array.from(channelsMap.values());
}

export function serializeM3U(channels: ChannelItem[], options?: { onlyActive?: boolean }): string {
  // Sort by group, then by canonical name
  const sorted = [...channels].sort((a, b) => {
    if (a.group !== b.group) {
      return a.group.localeCompare(b.group);
    }
    return a.name.localeCompare(b.name);
  });

  const outputLines: string[] = ['#EXTM3U x-tvg-url="https://raw.githubusercontent.com/aiorbd-video/epg/main/guide.xml"'];
  const exportedUrls = new Set<string>();

  for (const ch of sorted) {
    let chosenCandidate = ch.candidates[ch.selectedUrlIndex] || ch.candidates[0];

    if (options?.onlyActive) {
      const activeCand = ch.candidates.find(c => c.status === 'active');
      if (!activeCand) {
        continue;
      }
      chosenCandidate = activeCand;
    }

    if (chosenCandidate) {
      const cleanUrl = chosenCandidate.url.split('|')[0].trim();
      // Ensure strict single occurrence of any stream URL in the final M3U
      if (!exportedUrls.has(cleanUrl)) {
        exportedUrls.add(cleanUrl);
        outputLines.push(ch.extinf);
        outputLines.push(chosenCandidate.url);
      }
    }
  }

  return outputLines.join('\n') + '\n';
}
