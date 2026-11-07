import { sharedAudioUrl } from './audio-delivery';
import { imageCandidates, ipfsPath } from './archive-media';

export const AUDIO_CACHE = 'async-original-audio-v1';
const MAX_FILE = 96 * 1024 * 1024;
const MAX_CACHE = 256 * 1024 * 1024;
let writes: Promise<unknown> = Promise.resolve();

export function audioCacheKey(source: string): string | null {
  const path = ipfsPath(source);
  return path ? `https://async.art/__audio-cache/${path}` : null;
}

async function openCache(): Promise<Cache | null> {
  try {
    return await caches.open(AUDIO_CACHE);
  } catch {
    return null; // Private browsing/storage restrictions must not prevent listening.
  }
}

async function save(cache: Cache, key: string, blob: Blob): Promise<boolean> {
  const job = writes.then(async () => {
    try {
      const entries = await cache.keys();
      let bytes = 0;
      const sizes: { request: Request; size: number }[] = [];
      for (const request of entries) {
        const response = await cache.match(request);
        const size = Number(response?.headers.get('x-audio-bytes')) || 0;
        sizes.push({ request, size });
        bytes += size;
      }
      for (const entry of sizes) {
        if (bytes + blob.size <= MAX_CACHE) break;
        await cache.delete(entry.request);
        bytes -= entry.size;
      }
      await cache.put(
        key,
        new Response(blob, {
          headers: {
            'Content-Type': blob.type,
            'x-audio-bytes': String(blob.size),
          },
        }),
      );
      return true;
    } catch {
      return false;
    }
  });
  writes = job.catch(() => undefined);
  return job;
}

/** Full responses only: never retain partial downloads or gateway error documents. */
export async function prepareAudio(
  source: string,
  signal: AbortSignal,
  progress: (bytes: number) => void = () => {},
  preferred?: string,
): Promise<{ blob: Blob; cached: boolean; saved: boolean }> {
  const key = audioCacheKey(source);
  const cache = key ? await openCache() : null;
  signal.throwIfAborted();
  if (cache && key) {
    try {
      const hit = await cache.match(key);
      if (hit) {
        const blob = await hit.blob();
        signal.throwIfAborted();
        progress(blob.size);
        return { blob, cached: true, saved: true };
      }
    } catch {
      signal.throwIfAborted();
    }
  }
  const shared = await sharedAudioUrl(source, signal);
  signal.throwIfAborted();
  const urls = Array.from(
    new Set(
      [
        shared,
        preferred?.startsWith('/api/audio/') ? undefined : preferred,
        ...imageCandidates(source),
      ].filter((url): url is string => !!url),
    ),
  );
  for (const url of urls) {
    signal.throwIfAborted();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    let idle = setTimeout(abort, 20_000);
    const deadline = setTimeout(abort, 180_000);
    try {
      progress(0);
      const response = await fetch(url, { signal: controller.signal });
      const type = response.headers.get('content-type')?.split(';')[0] || '';
      const length = Number(response.headers.get('content-length'));
      if (
        response.status !== 200 ||
        !response.body ||
        /html|json|text\//i.test(type)
      )
        throw new Error('Not a complete media response');
      if (length > MAX_FILE)
        throw new Error('Audio file exceeds download limit');
      const reader = response.body.getReader();
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let bytes = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_FILE)
          throw new Error('Audio file exceeds download limit');
        chunks.push(new Uint8Array(value));
        progress(bytes);
        clearTimeout(idle);
        idle = setTimeout(abort, 20_000);
      }
      if (
        !bytes ||
        (length &&
          !response.headers.get('content-encoding') &&
          bytes !== length)
      )
        throw new Error('Incomplete audio');
      signal.throwIfAborted();
      const blob = new Blob(chunks, { type });
      const saved = cache && key ? await save(cache, key, blob) : false;
      signal.throwIfAborted();
      return { blob, cached: false, saved };
    } catch {
      signal.throwIfAborted();
    } finally {
      controller.abort();
      clearTimeout(idle);
      clearTimeout(deadline);
      signal.removeEventListener('abort', abort);
    }
  }
  throw new Error(
    'Could not download the complete audio. Retry or use streaming.',
  );
}
