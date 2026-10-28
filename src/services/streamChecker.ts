import { StreamCandidate } from '../types';

export interface ProbeResult {
  url: string;
  ok: boolean;
  status: number;
  latencyMs: number;
  contentType?: string;
  codecType?: string;
  error?: string;
}

export async function probeStream(url: string, signal?: AbortSignal): Promise<ProbeResult> {
  const startTime = Date.now();
  try {
    const response = await fetch(`/api/probe-stream?url=${encodeURIComponent(url)}`, {
      signal
    });

    if (response.ok) {
      const data: ProbeResult = await response.json();
      return data;
    } else {
      return {
        url,
        ok: false,
        status: response.status,
        latencyMs: Date.now() - startTime,
        error: `Server responded with ${response.status}`
      };
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        url,
        ok: false,
        status: 0,
        latencyMs: Date.now() - startTime,
        error: 'Aborted'
      };
    }

    // Fallback: direct browser fetch attempt
    try {
      const directController = new AbortController();
      const directTimeout = setTimeout(() => directController.abort(), 6000);
      const directResp = await fetch(url.split('|')[0], {
        method: 'HEAD',
        mode: 'no-cors',
        signal: directController.signal
      });
      clearTimeout(directTimeout);

      return {
        url,
        ok: true,
        status: 200,
        latencyMs: Date.now() - startTime,
        contentType: 'stream/video'
      };
    } catch {
      return {
        url,
        ok: false,
        status: 0,
        latencyMs: Date.now() - startTime,
        error: err.message || 'Connection failed'
      };
    }
  }
}

export class ConcurrentQueue {
  private concurrency: number;
  private running = 0;
  private queue: (() => Promise<void>)[] = [];
  private aborted = false;

  constructor(concurrency = 25) {
    this.concurrency = concurrency;
  }

  public setConcurrency(limit: number) {
    this.concurrency = Math.max(1, Math.min(limit, 100));
  }

  public abort() {
    this.aborted = true;
    this.queue = [];
  }

  public enqueue<T>(task: () => Promise<T>): Promise<T> {
    if (this.aborted) {
      return Promise.reject(new Error('Queue aborted'));
    }

    return new Promise((resolve, reject) => {
      const execute = async () => {
        if (this.aborted) {
          reject(new Error('Queue aborted'));
          return;
        }
        this.running++;
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.running--;
          this.dequeue();
        }
      };

      this.queue.push(execute);
      this.dequeue();
    });
  }

  private dequeue() {
    if (this.running >= this.concurrency || this.queue.length === 0 || this.aborted) {
      return;
    }
    const nextTask = this.queue.shift();
    if (nextTask) {
      nextTask();
    }
  }

  public get pending(): number {
    return this.queue.length;
  }

  public get activeCount(): number {
    return this.running;
  }
}
