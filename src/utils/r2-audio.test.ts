import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import sources from '@/data/archive-audio-sources.json';
const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  sign: vi.fn(),
  eval: vi.fn(),
  zrem: vi.fn(),
  destroy: vi.fn(),
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
vi.mock('@upstash/redis', () => ({
  Redis: { fromEnv: () => ({ eval: mocks.eval, zrem: mocks.zrem }) },
}));
import {
  allowedAudio,
  audioMime,
  audioObjectKey,
  downloadOriginal,
  resolveR2Audio,
} from './r2-audio';
const path = Object.keys(sources)[0];
const missing = { $metadata: { httpStatusCode: 404 } };
const mp3 = () =>
  new Response(new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, 0]), {
    headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': '10' },
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
  mocks.eval.mockResolvedValue(1);
  mocks.zrem.mockResolvedValue(1);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('R2 archive audio', () => {
  it('only allows exact recovered audio paths, never arbitrary URLs or sibling paths', () => {
    expect(allowedAudio(path)).toBe(true);
    expect(audioObjectKey(path)).toBe('archive-audio/v1/' + path);
    for (const value of [
      'https://example.com/audio.mp3',
      path + '/other',
      path + '/../private',
      '__proto__',
    ]) {
      expect(allowedAudio(value)).toBe(false);
      expect(() => audioObjectKey(value)).toThrow();
    }
  });
  it('signs an existing archive copy without downloading or writing anything', async () => {
    mocks.send.mockResolvedValue({
      ContentLength: 10,
      Metadata: { 'original-ipfs-path': path },
    });
    const result = await resolveR2Audio(path, true);
    expect(result.status).toBe('ready');
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.eval).not.toHaveBeenCalled();
    expect(mocks.sign.mock.calls[0][1].input).toEqual({
      Bucket: 'asyncart',
      Key: audioObjectKey(path),
    });
  });
  it('does not import on a read-only lookup', async () => {
    mocks.send.mockRejectedValue(missing);
    expect(await resolveR2Audio(path)).toEqual({ status: 'missing' });
    expect(mocks.eval).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it('copies complete original bytes with provenance and without overwriting', async () => {
    mocks.send.mockRejectedValueOnce(missing).mockResolvedValueOnce({});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mp3()),
    );
    expect((await resolveR2Audio(path, true)).status).toBe('ready');
    const put = mocks.send.mock.calls[1][0];
    expect(put.kind).toBe('put');
    expect(put.input.IfNoneMatch).toBe('*');
    expect(put.input.ContentType).toBe('audio/mpeg');
    expect(put.input.Body).toEqual(Buffer.from(await mp3().arrayBuffer()));
    expect(put.input.Metadata['original-ipfs-path']).toBe(path);
    expect(mocks.zrem).toHaveBeenCalledTimes(1);
  });
  it('does not overwrite unrecognized bucket objects', async () => {
    mocks.send.mockResolvedValue({ ContentLength: 10 });
    expect(await resolveR2Audio(path, true)).toEqual({ status: 'unavailable' });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it('does not turn R2 permission errors into attempted uploads', async () => {
    mocks.send.mockRejectedValue({ $metadata: { httpStatusCode: 403 } });
    await expect(resolveR2Audio(path, true)).rejects.toBeDefined();
    expect(mocks.eval).not.toHaveBeenCalled();
  });
  it('bounds imports with a shared limiter and fails closed without Redis', async () => {
    mocks.send.mockRejectedValue(missing);
    mocks.eval.mockResolvedValue(0);
    expect(await resolveR2Audio(path, true)).toEqual({ status: 'busy' });
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    expect(await resolveR2Audio(path, true)).toEqual({ status: 'busy' });
    expect(mocks.send).toHaveBeenCalledTimes(2);
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
          headers: { 'Content-Length': String(100 * 1024 * 1024) },
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      downloadOriginal(path, new AbortController().signal),
    ).rejects.toThrow('unavailable');
    expect(audioMime(Buffer.from('<html>error</html>'))).toBeNull();
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
      (await downloadOriginal(path, new AbortController().signal)).body
        .byteLength,
    ).toBe(10);
  });
  it('is disabled without credentials and aborts cancelled downloads', async () => {
    vi.stubEnv('R2_SECRET_ACCESS_KEY', '');
    expect(await resolveR2Audio(path, true)).toEqual({ status: 'disabled' });
    await expect(downloadOriginal(path, AbortSignal.abort())).rejects.toThrow();
  });
});
