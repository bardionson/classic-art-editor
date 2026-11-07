import { createHash } from 'node:crypto';
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { acquireR2Import } from './r2-import-limit';
import sources from '@/data/archive-audio-sources.json';

export const MAX_AUDIO_BYTES = 96 * 1024 * 1024;
const PREFIX = 'archive-audio/v1/';
const GATEWAYS = [
  'https://alchemy.mypinata.cloud/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
];
export function allowedAudio(path: string): boolean {
  return Object.prototype.hasOwnProperty.call(sources, path);
}
export function audioObjectKey(path: string): string {
  if (!allowedAudio(path)) throw new Error('Unknown archive audio');
  return PREFIX + path;
}

function connection() {
  const { R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } =
    process.env;
  if (!R2_ENDPOINT || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY)
    return null;
  const url = new URL(R2_ENDPOINT);
  if (
    url.protocol !== 'https:' ||
    !/^[a-f0-9]{32}(\.(eu|us|fedramp))?\.r2\.cloudflarestorage\.com$/.test(
      url.hostname,
    ) ||
    url.username ||
    url.password ||
    url.search ||
    (url.pathname !== '/' && url.pathname !== '')
  )
    throw new Error('Invalid R2 endpoint');
  return {
    bucket: R2_BUCKET,
    client: new S3Client({
      region: 'auto',
      endpoint: url.origin,
      forcePathStyle: true,
      maxAttempts: 1,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    }),
  };
}

/** Reject gateway error documents even when a gateway calls them binary data. */
export function audioMime(bytes: Uint8Array): string | null {
  const b = Buffer.from(bytes);
  const start = b.toString('ascii', 0, 12);
  if (start.startsWith('ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0))
    return 'audio/mpeg';
  if (start.startsWith('RIFF') && start.slice(8) === 'WAVE') return 'audio/wav';
  if (start.startsWith('fLaC')) return 'audio/flac';
  if (start.startsWith('OggS')) return 'audio/ogg';
  if (start.slice(4, 8) === 'ftyp') return 'audio/mp4';
  return null;
}

export async function downloadOriginal(path: string, signal: AbortSignal) {
  if (!allowedAudio(path)) throw new Error('Unknown archive audio');
  for (const gateway of GATEWAYS) {
    signal.throwIfAborted();
    try {
      const response = await fetch(gateway + path, {
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(14000)]),
      });
      const type = response.headers.get('content-type') ?? '';
      const length = Number(response.headers.get('content-length'));
      if (
        response.status !== 200 ||
        !response.body ||
        /html|json|text\//i.test(type) ||
        length > MAX_AUDIO_BYTES
      ) {
        await response.body?.cancel();
        continue;
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_AUDIO_BYTES)
            throw new Error('Audio exceeds import limit');
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      if (
        !size ||
        (length && !response.headers.get('content-encoding') && length !== size)
      )
        continue;
      const body = Buffer.concat(chunks);
      const contentType = audioMime(body);
      if (contentType) return { body, contentType };
    } catch {
      signal.throwIfAborted();
    }
  }
  throw new Error('Original audio unavailable');
}

export class AudioDeliveryError extends Error {
  constructor(
    public stage: string,
    public upstreamStatus?: number,
  ) {
    super('Archive audio unavailable');
    this.name = 'AudioDeliveryError';
  }
}
export type AudioDelivery =
  | { status: 'ready'; url: string }
  | { status: 'disabled' | 'missing' | 'busy' | 'unavailable' };
export async function resolveR2Audio(
  path: string,
  importMissing = false,
): Promise<AudioDelivery> {
  const key = audioObjectKey(path);
  const r2 = connection();
  if (!r2) return { status: 'disabled' };
  const { client, bucket } = r2;
  const signal = AbortSignal.timeout(53000);
  let stage = 'storage-read';
  try {
    let exists = false;
    try {
      const object = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
        { abortSignal: AbortSignal.timeout(5000) },
      );
      exists =
        !!object.ContentLength &&
        object.Metadata?.['original-ipfs-path'] === path;
      if (!exists) return { status: 'unavailable' }; // Never overwrite an unrecognized object.
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode !== 404
      )
        throw error;
    }
    if (!exists) {
      if (!importMissing) return { status: 'missing' };
      stage = 'import-limiter';
      const release = await acquireR2Import(client, bucket, path, signal);
      if (!release) return { status: 'busy' };
      try {
        stage = 'ipfs-download';
        const { body, contentType } = await downloadOriginal(path, signal);
        stage = 'storage-write';
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
            CacheControl: 'private, max-age=31536000, immutable',
            IfNoneMatch: '*',
            Metadata: {
              'original-ipfs-path': path,
              sha256: createHash('sha256').update(body).digest('hex'),
            },
          }),
          { abortSignal: signal },
        );
      } finally {
        await release().catch(() => undefined);
      }
    }
    stage = 'signing';
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 21600 },
    );
    return { status: 'ready', url };
  } catch (error) {
    throw new AudioDeliveryError(
      stage,
      (
        error as { $metadata?: { httpStatusCode?: number } }
      ).$metadata?.httpStatusCode,
    );
  } finally {
    client.destroy();
  }
}
