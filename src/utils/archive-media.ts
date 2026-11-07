import mediaTypes from '@/data/archive-media-types.json';

// Only original image references are used as previews. Metadata CIDs themselves
// are JSON documents, not images. Never inject inline HTML/SVG markup from metadata; referenced images use an img element.
export const IPFS_CID = /^(?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$/;
export const MEDIA_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://alchemy.mypinata.cloud/ipfs/',
];

export function ipfsPath(value: string): string | null {
  let path = value.trim().replace(/^ipfs:\/\/(?:ipfs\/)?/i, '');
  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      const subdomain = url.hostname.match(/^([^.]+)\.ipfs\./)?.[1];
      path = subdomain
        ? subdomain + url.pathname
        : (url.pathname.match(/^\/ipfs\/(.+)/)?.[1] ?? '');
    } catch {
      return null;
    }
  }
  path = path.split(/[?#]/)[0].replace(/\/$/, '');
  if (!IPFS_CID.test(path.split('/')[0])) return null;
  if (path.includes('\\') || /(?:^|\/)\.\.?(?:\/|$)/.test(path)) return null;
  try {
    if (
      decodeURIComponent(path)
        .split('/')
        .some((p) => p === '..' || p === '.')
    )
      return null;
  } catch {
    return null;
  }
  return path;
}

export function imageCandidates(value: unknown): string[] {
  if (typeof value !== 'string' || value.length > 4096) return [];
  const path = ipfsPath(value);
  if (path) return MEDIA_GATEWAYS.map((g) => g + path);
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return [];
    if (
      /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(
        url.hostname,
      ) ||
      !url.hostname.includes('.')
    )
      return [];
    return [url.href];
  } catch {
    return [];
  }
}

export function metadataImage(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  for (const value of [row.image, row.image_url]) {
    if (typeof value === 'string' && imageCandidates(value).length)
      return value;
  }
  return null;
}

// Format evidence applies to the exact immutable asset path, not its parent CID
// or another file within a directory. Unknown media keeps the existing image path.
export function isArchiveVideo(value: string): boolean {
  const path = ipfsPath(value);
  if (!path) return false;
  const evidence = (mediaTypes as Record<string, { contentType: string }>)[
    path
  ];
  return (
    evidence?.contentType === 'video/mp4' ||
    evidence?.contentType === 'video/webm'
  );
}

export type ArchivePlayback = { source: string; kind: 'audio' | 'video' };
// animation_url may contain audio, video, or an executable web page. Only
// native media elements consume it; never turn it into an iframe or HTML.
export function metadataPlayback(data: unknown): ArchivePlayback | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  for (const [field, source] of Object.entries({
    audio: row.audio,
    audio_url: row.audio_url,
    animation_url: row.animation_url,
  })) {
    if (typeof source !== 'string' || !imageCandidates(source).length) continue;
    if (/\.(?:html?|json|svg|png|jpe?g|gif|webp)(?:[?#]|$)/i.test(source))
      continue;
    const path = ipfsPath(source);
    const type = path
      ? (mediaTypes as Record<string, { contentType: string }>)[path]
          ?.contentType
      : undefined;
    if (type && !/^(audio|video)\//.test(type)) continue;
    const audio =
      type?.startsWith('audio/') ||
      (!type &&
        (field !== 'animation_url' ||
          /\.(?:mp3|wav|ogg|oga|m4a|aac|flac)(?:[?#]|$)/i.test(source)));
    return { source, kind: audio ? 'audio' : 'video' };
  }
  return null;
}
