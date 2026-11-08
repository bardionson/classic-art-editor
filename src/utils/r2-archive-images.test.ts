import { createHash } from 'node:crypto';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import sources from '@/data/archive-image-sources.json';
const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  sign: vi.fn(),
  eval: vi.fn(),
  zrem: vi.fn(),
  destroy: vi.fn(),
  derivative: vi.fn(),
}));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = mocks.send;
    destroy = mocks.destroy;
  },
  HeadObjectCommand: class {
    kind = 'head';
    constructor(public input: unknown) {}
  },
  GetObjectCommand: class {
    kind = 'get';
    constructor(public input: unknown) {}
  },
  PutObjectCommand: class {
    kind = 'put';
    constructor(public input: unknown) {}
  },
}));
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: mocks.sign }));
vi.mock('./r2-image-import-limit', () => ({
  acquireR2ImageImport: mocks.eval,
}));
vi.mock('./archive-image-derivative', async (original) => ({
  ...(await original<typeof import('./archive-image-derivative')>()),
  createArchiveImagePreview: mocks.derivative,
}));
import {
  allowedArchiveImage,
  imageMime,
  imageObjectKey,
  imagePreviewObjectKey,
  downloadOriginalImage,
  resolveR2Image,
} from './r2-archive-images';
const path = sources[0];
const missing = { $metadata: { httpStatusCode: 404 } };
const gifBytes = Buffer.from(
  '47494638396101000100800000000000ffffff2c00000000010001000002024401003b',
  'hex',
);
const mp3 = () =>
  new Response(gifBytes, {
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(gifBytes.length),
    },
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv(
    'R2_ENDPOINT',
    'https://55970efa14ced9af016c3f41d994fd81.r2.cloudflarestorage.com',
  );
  vi.stubEnv('R2_BUCKET', 'asyncart');
  vi.stubEnv('R2_ACCESS_KEY_ID', 'test');
  vi.stubEnv('R2_SECRET_ACCESS_KEY', 'test');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.com');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test');
  mocks.sign.mockResolvedValue(
    'https://example.r2.cloudflarestorage.com/signed',
  );
  mocks.eval.mockResolvedValue(mocks.zrem);
  mocks.zrem.mockResolvedValue(1);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('R2 archive images', () => {
  it('only allows exact recovered audio paths, never arbitrary URLs or sibling paths', () => {
    expect(allowedArchiveImage(path)).toBe(true);
    expect(imageObjectKey(path)).toBe('archive-images/v1/' + path);
    for (const value of [
      'https://example.com/audio.mp3',
      path + '/other',
      path + '/../private',
      '__proto__',
    ]) {
      expect(allowedArchiveImage(value)).toBe(false);
      expect(() => imageObjectKey(value)).toThrow();
    }
  });
  it('signs an existing archive copy without downloading or writing anything', async () => {
    mocks.send.mockResolvedValue({
      ContentLength: gifBytes.length,
      ContentType: 'image/gif',
      Metadata: {
        'original-ipfs-path': path,
        'verified-media': 'v1',
        sha256: 'a'.repeat(64),
      },
    });
    const result = await resolveR2Image(path, true);
    expect(result.status).toBe('ready');
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.eval).not.toHaveBeenCalled();
    expect(mocks.sign.mock.calls[0][1].input).toEqual({
      Bucket: 'asyncart',
      Key: imageObjectKey(path),
    });
  });
  it('does not import on a read-only lookup', async () => {
    mocks.send.mockRejectedValue(missing);
    expect(await resolveR2Image(path)).toEqual({ status: 'missing' });
    expect(mocks.eval).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it('copies complete original bytes with provenance and without overwriting', async () => {
    mocks.send.mockRejectedValueOnce(missing).mockResolvedValueOnce({});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mp3()),
    );
    expect((await resolveR2Image(path, true)).status).toBe('ready');
    const put = mocks.send.mock.calls[1][0];
    expect(put.kind).toBe('put');
    expect(put.input.IfNoneMatch).toBe('*');
    expect(put.input.ContentType).toBe('image/gif');
    expect(put.input.Body).toEqual(Buffer.from(await mp3().arrayBuffer()));
    expect(put.input.Metadata['original-ipfs-path']).toBe(path);
    expect(mocks.zrem).toHaveBeenCalledTimes(1);
  });
  it('does not overwrite unrecognized bucket objects', async () => {
    mocks.send.mockResolvedValue({ ContentLength: 10 });
    expect(await resolveR2Image(path, true)).toEqual({ status: 'unavailable' });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it('does not turn R2 permission errors into attempted uploads', async () => {
    mocks.send.mockRejectedValue({ $metadata: { httpStatusCode: 403 } });
    await expect(resolveR2Image(path, true)).rejects.toBeDefined();
    expect(mocks.eval).not.toHaveBeenCalled();
  });
  it('bounds imports with the shared R2 limiter', async () => {
    mocks.send.mockRejectedValue(missing);
    mocks.eval.mockResolvedValue(null);
    expect(await resolveR2Image(path, true)).toEqual({ status: 'busy' });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it('rejects partial audio, disguised HTML, and oversized responses', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('partial', { status: 206 }))
      .mockResolvedValueOnce(
        new Response('<html>error</html>', {
          headers: { 'Content-Type': 'application/octet-stream' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('too big', {
          headers: { 'Content-Length': String(129 * 1024 * 1024) },
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    fetcher.mockResolvedValue(new Response('<html>error</html>'));
    await expect(
      downloadOriginalImage(path, new AbortController().signal),
    ).rejects.toThrow('unavailable');
    expect(imageMime(Buffer.from('<html>error</html>'))).toBeNull();
  });
  it('falls back to another fixed gateway for a truncated file', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response('ID3', { headers: { 'Content-Length': '10' } }),
        )
        .mockResolvedValueOnce(mp3()),
    );
    expect(
      (await downloadOriginalImage(path, new AbortController().signal)).body
        .byteLength,
    ).toBe(gifBytes.length);
  });
  it('is disabled without credentials and aborts cancelled downloads', async () => {
    vi.stubEnv('R2_SECRET_ACCESS_KEY', '');
    expect(await resolveR2Image(path, true)).toEqual({ status: 'disabled' });
    await expect(
      downloadOriginalImage(path, AbortSignal.abort()),
    ).rejects.toThrow();
  });
});

it('sniffs native video while rejecting SVG, HTML, and unrecognized ISO containers', () => {
  expect(
    imageMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),
  ).toBeNull();
  expect(imageMime(Buffer.from('0000ftypheic00000000'))).toBeNull();
  expect(imageMime(Buffer.from('0000ftypisom00000000'))).toBe('video/mp4');
  expect(imageMime(gifBytes)).toBe('image/gif');
});
it('does not sign an object with an unsafe MIME or a mismatched original path', async () => {
  for (const bad of [
    {
      ContentType: 'text/html',
      Metadata: {
        'original-ipfs-path': path,
        'verified-media': 'v1',
        sha256: 'a'.repeat(64),
      },
    },
    {
      ContentType: 'image/png',
      Metadata: {
        'original-ipfs-path': path + '/sibling',
        'verified-media': 'v1',
        sha256: 'a'.repeat(64),
      },
    },
  ]) {
    mocks.send.mockResolvedValue({ ContentLength: 12, ...bad });
    expect(await resolveR2Image(path, true)).toEqual({ status: 'unavailable' });
  }
  expect(mocks.sign).not.toHaveBeenCalled();
});

const pngBytes = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]),
  Buffer.from('IHDR00000000'),
]);
const storedPng = {
  ContentLength: pngBytes.length,
  ContentType: 'image/png',
  Metadata: {
    'original-ipfs-path': path,
    'verified-media': 'v1',
    sha256: 'a'.repeat(64),
  },
};
it('stores original and preview bytes separately with bound provenance', async () => {
  mocks.send.mockRejectedValueOnce(missing).mockResolvedValue({});
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(pngBytes)),
  );
  const preview = Buffer.from('preview-webp');
  mocks.derivative.mockResolvedValue(preview);
  const result = await resolveR2Image(path, true);
  expect(result).toMatchObject({
    status: 'ready',
    contentType: 'image/webp',
    variant: 'preview',
  });
  const original = mocks.send.mock.calls[1][0].input;
  const derivative = mocks.send.mock.calls[2][0].input;
  expect(original.Key).toBe(imageObjectKey(path));
  expect(original.Body).toEqual(pngBytes);
  expect(original.ContentType).toBe('image/png');
  expect(derivative.Key).toBe(imagePreviewObjectKey(path));
  expect(derivative.Body).toEqual(preview);
  expect(derivative.Metadata['original-sha256']).toBe(original.Metadata.sha256);
  expect(derivative.IfNoneMatch).toBe('*');
  expect(mocks.sign.mock.calls[0][1].input.Key).toBe(
    imagePreviewObjectKey(path),
  );
});
it('uses a ready derivative only when its original checksum matches', async () => {
  const preview = {
    ContentLength: 12,
    ContentType: 'image/webp',
    Metadata: {
      'original-ipfs-path': path,
      'verified-media': 'preview-v1',
      'original-sha256': 'a'.repeat(64),
      sha256: 'b'.repeat(64),
    },
  };
  mocks.send.mockResolvedValueOnce(storedPng).mockResolvedValueOnce(preview);
  expect(await resolveR2Image(path)).toMatchObject({ variant: 'preview' });
  expect(mocks.sign.mock.calls[0][1].input.Key).toBe(
    imagePreviewObjectKey(path),
  );
  mocks.send.mockResolvedValueOnce(storedPng).mockResolvedValueOnce({
    ...preview,
    Metadata: { ...preview.Metadata, 'original-sha256': 'c'.repeat(64) },
  });
  expect(await resolveR2Image(path)).toMatchObject({ variant: 'original' });
  expect(mocks.sign.mock.calls[1][1].input.Key).toBe(imageObjectKey(path));
});
it('serves the original on explicit request without reading or creating a derivative', async () => {
  mocks.send.mockResolvedValue(storedPng);
  expect(await resolveR2Image(path, false, true)).toMatchObject({
    contentType: 'image/png',
    variant: 'original',
  });
  expect(mocks.send).toHaveBeenCalledTimes(1);
  expect(mocks.derivative).not.toHaveBeenCalled();
});
it('preserves successful original imports when preview generation fails', async () => {
  mocks.send.mockRejectedValueOnce(missing).mockResolvedValue({});
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(pngBytes)),
  );
  mocks.derivative.mockRejectedValue(new Error('decode limit'));
  expect(await resolveR2Image(path, true)).toMatchObject({
    contentType: 'image/png',
    variant: 'original',
  });
  expect(mocks.sign.mock.calls[0][1].input.Key).toBe(imageObjectKey(path));
});

it('backfills a preview from an intact cached original without downloading or rewriting the original', async () => {
  const digest = createHash('sha256').update(pngBytes).digest('hex');
  mocks.send
    .mockResolvedValueOnce({
      ...storedPng,
      Metadata: { ...storedPng.Metadata, sha256: digest },
    })
    .mockRejectedValueOnce(missing)
    .mockResolvedValueOnce({
      Body: (async function* () {
        yield pngBytes;
      })(),
    })
    .mockResolvedValueOnce({});
  mocks.derivative.mockResolvedValue(Buffer.from('webp-preview'));
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  expect(await resolveR2Image(path, true)).toMatchObject({
    variant: 'preview',
    contentType: 'image/webp',
  });
  expect(fetcher).not.toHaveBeenCalled();
  const writes = mocks.send.mock.calls
    .map((c) => c[0])
    .filter((c) => c.kind === 'put');
  expect(writes).toHaveLength(1);
  expect(writes[0].input.Key).toBe(imagePreviewObjectKey(path));
});
it('does not derive from a cached original whose bytes fail its preserved checksum', async () => {
  mocks.send
    .mockResolvedValueOnce(storedPng)
    .mockRejectedValueOnce(missing)
    .mockResolvedValueOnce({
      Body: (async function* () {
        yield pngBytes;
      })(),
    });
  expect(await resolveR2Image(path, true)).toMatchObject({
    variant: 'original',
  });
  expect(mocks.derivative).not.toHaveBeenCalled();
  expect(mocks.send.mock.calls.filter((c) => c[0].kind === 'put')).toHaveLength(
    0,
  );
});
