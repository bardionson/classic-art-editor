import { ipfsPath } from './archive-media';

export function archiveAudioUrl(source: string): string | null {
  const path = ipfsPath(source);
  return path ? `/api/audio/stream?path=${encodeURIComponent(path)}` : null;
}

/** Resolve a fresh signed URL; never persist the expiring URL in browser storage. */
export async function sharedAudioUrl(
  source: string,
  signal: AbortSignal,
): Promise<string | null> {
  const path = ipfsPath(source);
  if (!path) return null;
  try {
    const response = await fetch(
      `/api/audio?path=${encodeURIComponent(path)}`,
      {
        method: 'POST',
        signal: AbortSignal.any([signal, AbortSignal.timeout(58000)]),
        cache: 'no-store',
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== 'ready' || typeof data.url !== 'string') return null;
    const url = new URL(data.url);
    if (
      url.protocol !== 'https:' ||
      !url.hostname.endsWith('.r2.cloudflarestorage.com') ||
      url.username ||
      url.password
    )
      return null;
    return url.href;
  } catch {
    signal.throwIfAborted();
    return null;
  }
}
