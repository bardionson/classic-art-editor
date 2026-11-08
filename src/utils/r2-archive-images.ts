import { IPFS_PATH_GATEWAYS } from './ipfs-gateways';
import { createHash } from 'node:crypto';
import {
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { acquireR2ImageImport } from './r2-image-import-limit';
import sources from '@/data/archive-image-sources.json';
import { audioStorageConnection } from './r2-audio';
import {
  createArchiveImagePreview,
  staticPreviewType,
  MAX_PREVIEW_BYTES,
} from './archive-image-derivative';

export const MAX_IMAGE_BYTES = 128 * 1024 * 1024;
const PREFIX = 'archive-images/v1/';
const GATEWAYS = IPFS_PATH_GATEWAYS;
const allowed = new Set<string>(sources);
export function allowedArchiveImage(path: string): boolean {
  return allowed.has(path);
}
export function imageObjectKey(path: string): string {
  if (!allowedArchiveImage(path)) throw new Error('Unknown archive image');
  return PREFIX + path;
}

/** Reject gateway error documents even when a gateway calls them binary data. */
export function imageMime(bytes: Uint8Array): string | null {
  const b = Buffer.from(bytes);
  if (b.length < 12) return null;
  if (
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    b.toString('ascii', 12, 16) === 'IHDR'
  )
    return 'image/png';
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  const start = b.toString('ascii', 0, 12);
  if (start.startsWith('GIF87a') || start.startsWith('GIF89a'))
    return 'image/gif';
  if (start.startsWith('RIFF') && start.slice(8) === 'WEBP')
    return 'image/webp';
  if (start.slice(4, 8) === 'ftyp') {
    const brand = b.toString('ascii', 8, 12);
    if (['avif', 'avis'].includes(brand)) return 'image/avif';
    if (
      ['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V ', 'qt  ', 'dash'].includes(
        brand,
      )
    )
      return 'video/mp4';
  }
  if (
    b.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])) &&
    b.subarray(0, 4096).includes(Buffer.from('webm'))
  )
    return 'video/webm';
  return null;
}
const SUPPORTED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
]);

export async function downloadOriginalImage(path: string, signal: AbortSignal) {
  if (!allowedArchiveImage(path)) throw new Error('Unknown archive image');
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
        length > MAX_IMAGE_BYTES
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
          if (size > MAX_IMAGE_BYTES)
            throw new Error('Image exceeds import limit');
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
      const contentType = imageMime(body);
      if (contentType) return { body, contentType };
    } catch {
      signal.throwIfAborted();
    }
  }
  throw new Error('Original image unavailable');
}

export class ImageDeliveryError extends Error {
  constructor(
    public stage: string,
    public upstreamStatus?: number,
  ) {
    super('Archive image unavailable');
    this.name = 'ImageDeliveryError';
  }
}
export type ImageDelivery =
  | {
      status: 'ready';
      url: string;
      contentType: string;
      variant: 'original' | 'preview';
    }
  | { status: 'disabled' | 'missing' | 'busy' | 'unavailable' };
export function imagePreviewObjectKey(path: string) {
  if (!allowedArchiveImage(path)) throw new Error('Unknown archive image');
  return 'archive-images/preview-v1/' + path + '.webp';
}
type StoredObject = {
  ContentLength?: number;
  ContentType?: string;
  Metadata?: Record<string, string>;
};
const sha256 = (body: Uint8Array) =>
  createHash('sha256').update(body).digest('hex');
function validOriginal(object: StoredObject, path: string) {
  return (
    (object.ContentLength ?? 0) > 0 &&
    (object.ContentLength ?? 0) <= MAX_IMAGE_BYTES &&
    SUPPORTED_TYPES.has(object.ContentType ?? '') &&
    object.Metadata?.['original-ipfs-path'] === path &&
    object.Metadata?.['verified-media'] === 'v1' &&
    /^[a-f0-9]{64}$/.test(object.Metadata?.sha256 ?? '')
  );
}
function validPreview(object: StoredObject, path: string, originalSha: string) {
  return (
    (object.ContentLength ?? 0) > 0 &&
    (object.ContentLength ?? 0) <= MAX_PREVIEW_BYTES &&
    object.ContentType === 'image/webp' &&
    object.Metadata?.['original-ipfs-path'] === path &&
    object.Metadata?.['verified-media'] === 'preview-v1' &&
    object.Metadata?.['original-sha256'] === originalSha &&
    /^[a-f0-9]{64}$/.test(object.Metadata?.sha256 ?? '')
  );
}
const statusCode = (error: unknown) =>
  (error as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode;
export async function resolveR2Image(
  path: string,
  importMissing = false,
  original = false,
): Promise<ImageDelivery> {
  const key = imageObjectKey(path);
  const previewKey = imagePreviewObjectKey(path);
  const r2 = audioStorageConnection();
  if (!r2) return { status: 'disabled' };
  const { client, bucket } = r2;
  const signal = AbortSignal.timeout(53000);
  let stage = 'storage-read';
  let object: StoredObject | undefined;
  let selectedKey = key;
  let selectedType = '';
  const head = async (objectKey: string) => {
    try {
      return await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: objectKey }),
        { abortSignal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) },
      );
    } catch (error) {
      if (statusCode(error) === 404) return undefined;
      throw error;
    }
  };
  try {
    object = await head(key);
    if (object && !validOriginal(object, path))
      return { status: 'unavailable' };
    if (!object && !importMissing) return { status: 'missing' };
    selectedType = object?.ContentType ?? '';
    let previewExists = false;
    let previewConflict = false;
    if (object && !original && staticPreviewType(selectedType)) {
      // A derivative failure never prevents delivery of the preserved original.
      try {
        const preview = await head(previewKey);
        previewExists =
          !!preview && validPreview(preview, path, object.Metadata!.sha256);
        previewConflict = !!preview && !previewExists;
      } catch {
        /* Use the original; a later warm may retry the derivative. */
      }
    }
    if (previewExists) {
      selectedKey = previewKey;
      selectedType = 'image/webp';
    }
    const needsImport = !object;
    const needsPreview =
      !original &&
      !previewExists &&
      !previewConflict &&
      (!object || staticPreviewType(selectedType));
    if (importMissing && (needsImport || needsPreview)) {
      stage = 'import-limiter';
      const release = await acquireR2ImageImport(client, bucket, path, signal);
      if (!release && !object) return { status: 'busy' };
      if (release) {
        try {
          let body: Buffer | undefined;
          if (!object) {
            stage = 'ipfs-download';
            const download = await downloadOriginalImage(path, signal);
            body = download.body;
            selectedType = download.contentType;
            stage = 'storage-write';
            const metadata = {
              'original-ipfs-path': path,
              'verified-media': 'v1',
              sha256: sha256(body),
            };
            await client.send(
              new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: selectedType,
                CacheControl: 'private, max-age=31536000, immutable',
                IfNoneMatch: '*',
                Metadata: metadata,
              }),
              { abortSignal: signal },
            );
            object = {
              ContentType: selectedType,
              ContentLength: body.length,
              Metadata: metadata,
            };
          }
          if (
            !original &&
            !previewConflict &&
            staticPreviewType(selectedType)
          ) {
            try {
              stage = 'preview-generation';
              if (!body) {
                const response = await client.send(
                  new GetObjectCommand({ Bucket: bucket, Key: key }),
                  { abortSignal: signal },
                );
                const chunks: Uint8Array[] = [];
                let size = 0;
                if (!response.Body) throw new Error('Missing original body');
                for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
                  signal.throwIfAborted();
                  size += chunk.byteLength;
                  if (size > MAX_IMAGE_BYTES || size > object!.ContentLength!)
                    throw new Error('Original exceeds limit');
                  chunks.push(chunk);
                }
                body = Buffer.concat(chunks);
                if (
                  size !== object!.ContentLength ||
                  sha256(body) !== object!.Metadata!.sha256
                )
                  throw new Error('Original integrity mismatch');
              }
              signal.throwIfAborted();
              const preview = await createArchiveImagePreview(
                body,
                selectedType,
              );
              signal.throwIfAborted();
              if (preview) {
                await client.send(
                  new PutObjectCommand({
                    Bucket: bucket,
                    Key: previewKey,
                    Body: preview,
                    ContentType: 'image/webp',
                    CacheControl: 'private, max-age=31536000, immutable',
                    IfNoneMatch: '*',
                    Metadata: {
                      'original-ipfs-path': path,
                      'verified-media': 'preview-v1',
                      'original-sha256': object!.Metadata!.sha256,
                      sha256: sha256(preview),
                    },
                  }),
                  { abortSignal: signal },
                );
                selectedKey = previewKey;
                selectedType = 'image/webp';
              }
            } catch {
              /* Preserve a usable original if decoding or preview storage fails. */
            }
          }
        } finally {
          await release().catch(() => undefined);
        }
      }
    }
    stage = 'signing';
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: selectedKey }),
      { expiresIn: 21600 },
    );
    return {
      status: 'ready',
      url,
      contentType: selectedType,
      variant: selectedKey === key ? 'original' : 'preview',
    };
  } catch (error) {
    throw new ImageDeliveryError(stage, statusCode(error));
  } finally {
    client.destroy();
  }
}
