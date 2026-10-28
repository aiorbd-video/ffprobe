import { ChannelItem, StreamCandidate } from '../types';

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
  'VLC/3.0.18 LibVLC/3.0.18',
  'Kodi/19.5 (Windows NT 10.0; Win64; x64) App_Bitness/64 Version/19.5-Matrix'
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

export function normalizeName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ');
  return toTitleCase(cleaned);
}

export function standardizeData(line: string, url: string): {
  extinfClean: string;
  group: string;
  channelName: string;
  logo?: string;
  tvgId?: string;
} {
  const commaIdx = line.indexOf(',');
  const headerPart = commaIdx !== -1 ? line.slice(0, commaIdx) : line;
  const channelName = commaIdx !== -1 ? line.slice(commaIdx + 1).trim() : 'Unknown Channel';
  const channelNameLower = channelName.toLowerCase();

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
      'abp ', 'ndtv', 'republic', 'aaj tak', 'sports18', 'jio ', 'jalsha'
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

  // Update or insert group-title
  let extinfClean = line;
  if (groupMatch) {
    extinfClean = line.replace(`group-title="${originalGroup}"`, `group-title="${cleanGroup}"`);
  } else {
    extinfClean = `${headerPart} group-title="${cleanGroup}",${channelName}`;
  }

  // Extract logo
  const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
  const logo = logoMatch ? logoMatch[1].trim() : undefined;

  // Extract tvg-id
  const tvgIdMatch = line.match(/tvg-id="([^"]+)"/i);
  const tvgId = tvgIdMatch ? tvgIdMatch[1].trim() : undefined;

  return {
    extinfClean,
    group: cleanGroup,
    channelName,
    logo,
    tvgId
  };
}

export function parseM3U(content: string): ChannelItem[] {
  const lines = content.split(/\r?\n/);
  const channelsMap: Map<string, ChannelItem> = new Map();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF')) {
      if (i + 1 < lines.length) {
        const streamUrl = lines[i + 1].trim();
        if (streamUrl && !streamUrl.startsWith('#') && streamUrl.startsWith('http')) {
          const { extinfClean, group, channelName, logo, tvgId } = standardizeData(line, streamUrl);
          const normName = normalizeName(channelName);

          const candidate: StreamCandidate = {
            id: `cand-${Math.random().toString(36).slice(2, 9)}`,
            url: streamUrl,
            status: 'untested'
          };

          const existing = channelsMap.get(normName);
          if (existing) {
            // Avoid duplicate identical URL in same channel
            if (!existing.candidates.some(c => c.url === streamUrl)) {
              existing.candidates.push(candidate);
            }
            if (!existing.logo && logo) {
              existing.logo = logo;
            }
          } else {
            channelsMap.set(normName, {
              id: `ch-${Math.random().toString(36).slice(2, 9)}`,
              extinf: extinfClean,
              rawExtinf: line,
              name: channelName,
              normalizedName: normName,
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
  // Sort by group, then by name (matching auto_m3u.py line 236)
  const sorted = [...channels].sort((a, b) => {
    if (a.group !== b.group) {
      return a.group.localeCompare(b.group);
    }
    return a.name.localeCompare(b.name);
  });

  const outputLines: string[] = ['#EXTM3U'];

  for (const ch of sorted) {
    let chosenCandidate = ch.candidates[ch.selectedUrlIndex] || ch.candidates[0];

    // If onlyActive is true, verify that the candidate is active or find one active candidate
    if (options?.onlyActive) {
      const activeCand = ch.candidates.find(c => c.status === 'active');
      if (!activeCand) {
        // Skip channel if no active link
        continue;
      }
      chosenCandidate = activeCand;
    }

    if (chosenCandidate) {
      outputLines.push(ch.extinf);
      outputLines.push(chosenCandidate.url);
    }
  }

  return outputLines.join('\n') + '\n';
}
