import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  'VLC/3.0.18 LibVLC/3.0.18',
  'Kodi/19.5 (Windows NT 10.0; Win64; x64) App_Bitness/64 Version/19.5-Matrix'
];

function getRandomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function m3uApiPlugin(): Plugin {
  return {
    name: 'm3u-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const parsedUrl = new URL(req.url || '/', 'http://localhost:3000');
        const pathname = parsedUrl.pathname;

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        // Endpoint: /api/local-playlist
        if (pathname === '/api/local-playlist') {
          const fileKey = parsedUrl.searchParams.get('key') || 'working';
          let filePath = '';
          if (fileKey === 'working') {
            filePath = path.resolve(process.cwd(), 'working.m3u');
          } else if (fileKey === 'bangla') {
            filePath = path.resolve(process.cwd(), 'skym3u/bangla-hindi-sports.m3u');
          } else if (fileKey === 'russia') {
            filePath = path.resolve(process.cwd(), 'skym3u/russia.m3u');
          } else {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Unknown file key' }));
            return;
          }

          try {
            if (fs.existsSync(filePath)) {
              const content = await fs.promises.readFile(filePath, 'utf-8');
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/plain; charset=utf-8');
              res.end(content);
            } else {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'File not found' }));
            }
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // Endpoint: /api/fetch-remote
        if (pathname === '/api/fetch-remote') {
          const targetUrl = parsedUrl.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'URL parameter missing' }));
            return;
          }

          try {
            const cleanUrl = targetUrl.split('|')[0];
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(cleanUrl, {
              headers: { 'User-Agent': getRandomUA() },
              signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) {
              res.statusCode = response.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: `Remote returned HTTP ${response.status}` }));
              return;
            }

            const text = await response.text();
            
            // Check if this is a Gist list of M3U URLs (lines starting with http but not #EXTM3U)
            if (!text.includes('#EXTINF') && (text.includes('http://') || text.includes('https://'))) {
              const sourceUrls = text
                .split(/\r?\n/)
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('#') && (l.startsWith('http://') || l.startsWith('https://')));
              
              if (sourceUrls.length > 0) {
                const fetchedSub = await Promise.allSettled(
                  sourceUrls.map(async (u) => {
                    const c = new AbortController();
                    const t = setTimeout(() => c.abort(), 12000);
                    const r = await fetch(u.split('|')[0], { headers: { 'User-Agent': getRandomUA() }, signal: c.signal });
                    clearTimeout(t);
                    return r.ok ? await r.text() : '';
                  })
                );
                
                const combined = ['#EXTM3U'];
                for (const item of fetchedSub) {
                  if (item.status === 'fulfilled' && item.value) {
                    combined.push(item.value.replace('#EXTM3U', '').trim());
                  }
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end(combined.join('\n'));
                return;
              }
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(text);
          } catch (err: any) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Fetch failed' }));
          }
          return;
        }

        // Endpoint: /api/probe-stream
        if (pathname === '/api/probe-stream') {
          const targetUrl = parsedUrl.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'URL missing' }));
            return;
          }

          const cleanUrl = targetUrl.split('|')[0];
          const startTime = Date.now();
          const ua = getRandomUA();

          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            let resp: Response | null = null;
            let status = 0;
            let contentType = '';

            // Try HEAD first
            try {
              resp = await fetch(cleanUrl, {
                method: 'HEAD',
                headers: { 'User-Agent': ua },
                signal: controller.signal,
                redirect: 'follow'
              });
              status = resp.status;
              contentType = resp.headers.get('content-type') || '';
            } catch (headErr) {
              // Fallback to GET with small Range request
              resp = null;
            }

            // If HEAD was rejected (e.g. 405 Method Not Allowed) or failed, try GET with Range
            if (!resp || status === 405 || status === 403 || status >= 500) {
              const getResp = await fetch(cleanUrl, {
                method: 'GET',
                headers: {
                  'User-Agent': ua,
                  'Range': 'bytes=0-2048'
                },
                signal: controller.signal,
                redirect: 'follow'
              });
              status = getResp.status;
              contentType = getResp.headers.get('content-type') || '';
              // Cancel body reading to save bandwidth
              try {
                if (getResp.body) {
                  const reader = getResp.body.getReader();
                  await reader.cancel();
                }
              } catch {
                // ignore
              }
            }

            clearTimeout(timeout);
            const latencyMs = Date.now() - startTime;
            const isOk = status >= 200 && status < 400;

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              url: cleanUrl,
              ok: isOk,
              status,
              contentType,
              latencyMs,
              codecType: contentType.includes('mpegurl') || cleanUrl.includes('.m3u8')
                ? 'HLS / Video'
                : contentType.includes('video')
                ? 'Video'
                : contentType.includes('audio')
                ? 'Audio'
                : 'Stream'
            }));
          } catch (err: any) {
            const latencyMs = Date.now() - startTime;
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              url: cleanUrl,
              ok: false,
              status: 0,
              error: err.name === 'AbortError' ? 'Connection Timeout (8s)' : err.message || 'Stream Unreachable',
              latencyMs
            }));
          }
          return;
        }

        // Endpoint: /api/batch-probe
        if (pathname === '/api/batch-probe' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body || '{}');
              const urls: string[] = Array.isArray(payload.urls) ? payload.urls.slice(0, 100) : [];
              
              const results = await Promise.all(
                urls.map(async (streamUrl) => {
                  const cleanUrl = streamUrl.split('|')[0];
                  const startTime = Date.now();
                  const ua = getRandomUA();
                  try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 6000);
                    const resp = await fetch(cleanUrl, {
                      method: 'GET',
                      headers: { 'User-Agent': ua, 'Range': 'bytes=0-1024' },
                      signal: controller.signal,
                      redirect: 'follow'
                    });
                    clearTimeout(timeout);
                    try {
                      if (resp.body) {
                        const reader = resp.body.getReader();
                        await reader.cancel();
                      }
                    } catch {}
                    const isOk = resp.status >= 200 && resp.status < 400;
                    return {
                      url: streamUrl,
                      ok: isOk,
                      status: resp.status,
                      contentType: resp.headers.get('content-type') || '',
                      latencyMs: Date.now() - startTime
                    };
                  } catch (err: any) {
                    return {
                      url: streamUrl,
                      ok: false,
                      status: 0,
                      error: err.name === 'AbortError' ? 'Timeout' : (err.message || 'Error'),
                      latencyMs: Date.now() - startTime
                    };
                  }
                })
              );

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ results }));
            } catch (err: any) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    m3uApiPlugin()
  ],
  server: {
    host: '0.0.0.0',
    port: 3000
  }
});
