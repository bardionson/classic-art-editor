import { createHash } from 'node:crypto';
import {
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import manifest from '@/data/archive-audio-optimized.json';
import {
  allowedAudio,
  audioStorageConnection,
  AudioDelivery,
} from './r2-audio';
import { acquireR2Import } from './r2-import-limit';

type Copy = {
  sha256: string;
  bytes: number;
  duration: number;
  sourceSha256: string;
  sourceBytes: number;
  codec: string;
};
export function optimizedAudio(path: string): Copy | null {
  return allowedAudio(path) &&
    Object.prototype.hasOwnProperty.call(manifest, path)
    ? (manifest as Record<string, Copy>)[path]
    : null;
}
export function optimizedObjectKey(path: string): string {
  const copy = optimizedAudio(path);
  if (!copy) throw new Error('Unknown streaming copy');
  return `archive-audio/stream/aac-v1/${copy.sha256}.m4a`;
}
export function validateStreamingCopy(path: string, body: Uint8Array): boolean {
  const copy = optimizedAudio(path);
  return (
    !!copy &&
    body.byteLength === copy.bytes &&
    createHash('sha256').update(body).digest('hex') === copy.sha256
  );
}

/** Only exact, locally verified derivatives in the committed manifest may be stored.
 * The original CID-addressed files are never replaced. No arbitrary upload URLs. */
export async function resolveOptimizedAudio(
  path: string,
  body?: Uint8Array,
): Promise<AudioDelivery> {
  const copy = optimizedAudio(path);
  if (!copy || (body && !validateStreamingCopy(path, body)))
    throw new Error('Invalid streaming copy');
  const r2 = audioStorageConnection();
  if (!r2) return { status: 'disabled' };
  const { client, bucket } = r2;
  const key = optimizedObjectKey(path);
  const signal = AbortSignal.timeout(25000);
  try {
    let exists = false;
    try {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
        { abortSignal: AbortSignal.timeout(4000) },
      );
      exists =
        head.ContentLength === copy.bytes &&
        head.Metadata?.sha256 === copy.sha256 &&
        head.Metadata?.['source-sha256'] === copy.sourceSha256 &&
        head.Metadata?.codec === copy.codec;
      if (!exists) return { status: 'unavailable' };
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode !== 404
      )
        throw error;
    }
    if (!exists) {
      if (!body) return { status: 'missing' };
      const release = await acquireR2Import(
        client,
        bucket,
        'optimized:' + path,
        signal,
      );
      if (!release) return { status: 'busy' };
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: 'audio/mp4',
            CacheControl: 'private, max-age=31536000, immutable',
            IfNoneMatch: '*',
            Metadata: {
              sha256: copy.sha256,
              'source-sha256': copy.sourceSha256,
              'original-ipfs-path': path,
              codec: copy.codec,
            },
          }),
          { abortSignal: signal },
        );
      } finally {
        await release().catch(() => undefined);
      }
    }
    return {
      status: 'ready',
      url: await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: 21600 },
      ),
    };
  } finally {
    client.destroy();
  }
}

export async function readStreamingCopy(
  request: Request,
  path: string,
): Promise<Uint8Array> {
  const copy = optimizedAudio(path);
  if (!copy || copy.bytes > 4 * 1024 * 1024 || !request.body)
    throw new Error('Invalid streaming copy');
  const length = request.headers.get('content-length');
  if (length !== null && Number(length) !== copy.bytes)
    throw new Error('Invalid streaming copy');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > copy.bytes) throw new Error('Invalid streaming copy');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const body = Buffer.concat(chunks);
  if (!validateStreamingCopy(path, body))
    throw new Error('Invalid streaming copy');
  return body;
}
