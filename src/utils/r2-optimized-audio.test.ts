import { beforeEach, describe, it, expect, vi } from 'vitest';
import { createHash } from 'node:crypto';
const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  sign: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  destroy: vi.fn(),
  connection: vi.fn(),
}));
vi.mock('@/data/archive-audio-optimized.json', async () => {
  const { createHash } = await import('node:crypto');
  return {
    default: {
      known: {
        sha256: createHash('sha256')
          .update('verified AAC fixture')
          .digest('hex'),
        bytes: 20,
        sourceSha256: 'original-hash',
        sourceBytes: 400,
        duration: 10,
        codec: 'aac-lc-128k-v1',
      },
    },
  };
});
vi.mock('./r2-audio', () => ({
  allowedAudio: (path: string) => path === 'known',
  audioStorageConnection: mocks.connection,
}));
vi.mock('@aws-sdk/client-s3', () => ({
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
vi.mock('./r2-import-limit', () => ({ acquireR2Import: mocks.acquire }));
import {
  optimizedAudio,
  optimizedObjectKey,
  validateStreamingCopy,
  readStreamingCopy,
  resolveOptimizedAudio,
} from './r2-optimized-audio';
const body = Buffer.from('verified AAC fixture');
const sha = createHash('sha256').update(body).digest('hex');
const missing = { $metadata: { httpStatusCode: 404 } };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.connection.mockReturnValue({
    client: { send: mocks.send, destroy: mocks.destroy },
    bucket: 'archive',
  });
  mocks.acquire.mockResolvedValue(mocks.release);
  mocks.release.mockResolvedValue(undefined);
  mocks.sign.mockResolvedValue('https://storage.example/signed');
});
describe('verified streaming derivatives', () => {
  it('allows only committed paths and exact bytes', () => {
    expect(validateStreamingCopy('known', body)).toBe(true);
    expect(validateStreamingCopy('known', Buffer.alloc(body.length))).toBe(
      false,
    );
    expect(validateStreamingCopy('known', body.subarray(1))).toBe(false);
    for (const path of [
      '__proto__',
      'https://example.com/a',
      'known/../other',
    ]) {
      expect(optimizedAudio(path)).toBeNull();
      expect(() => optimizedObjectKey(path)).toThrow();
    }
  });
  it('rejects invalid bytes before connecting to storage', async () => {
    await expect(
      resolveOptimizedAudio('known', Buffer.alloc(20)),
    ).rejects.toThrow();
    expect(mocks.connection).not.toHaveBeenCalled();
  });
  it('bounds and hashes the request body even without a content length', async () => {
    const request = (data: Uint8Array, headers?: HeadersInit) =>
      new Request('https://example.com', {
        method: 'POST',
        body: new Uint8Array(data),
        headers,
      });
    expect(await readStreamingCopy(request(body), 'known')).toEqual(body);
    await expect(
      readStreamingCopy(request(Buffer.alloc(21)), 'known'),
    ).rejects.toThrow();
    await expect(
      readStreamingCopy(request(body.subarray(1)), 'known'),
    ).rejects.toThrow();
    await expect(
      readStreamingCopy(request(body, { 'Content-Length': '19' }), 'known'),
    ).rejects.toThrow();
  });
  it('signs a verified existing copy without uploading', async () => {
    mocks.send.mockResolvedValue({
      ContentLength: 20,
      Metadata: {
        sha256: sha,
        'source-sha256': 'original-hash',
        codec: 'aac-lc-128k-v1',
      },
    });
    expect((await resolveOptimizedAudio('known')).status).toBe('ready');
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.acquire).not.toHaveBeenCalled();
    expect(mocks.sign.mock.calls[0][1].input.Key).toBe(
      `archive-audio/stream/aac-v1/${sha}.m4a`,
    );
    expect(mocks.destroy).toHaveBeenCalled();
  });
  it('does not import on a read-only lookup', async () => {
    mocks.send.mockRejectedValue(missing);
    expect(await resolveOptimizedAudio('known')).toEqual({ status: 'missing' });
    expect(mocks.acquire).not.toHaveBeenCalled();
  });
  it('stores exact bytes separately from originals with provenance and no overwrite', async () => {
    mocks.send.mockRejectedValueOnce(missing).mockResolvedValueOnce({});
    expect((await resolveOptimizedAudio('known', body)).status).toBe('ready');
    const put = mocks.send.mock.calls[1][0];
    expect(put.kind).toBe('put');
    expect(put.input).toMatchObject({
      Key: `archive-audio/stream/aac-v1/${sha}.m4a`,
      Body: body,
      IfNoneMatch: '*',
      ContentType: 'audio/mp4',
      Metadata: {
        sha256: sha,
        'source-sha256': 'original-hash',
        'original-ipfs-path': 'known',
      },
    });
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it('never overwrites an unrecognized object or imports after permission failures', async () => {
    mocks.send.mockResolvedValueOnce({ ContentLength: 20 });
    expect(await resolveOptimizedAudio('known', body)).toEqual({
      status: 'unavailable',
    });
    mocks.send.mockRejectedValueOnce({ $metadata: { httpStatusCode: 403 } });
    await expect(resolveOptimizedAudio('known', body)).rejects.toBeDefined();
    expect(mocks.acquire).not.toHaveBeenCalled();
  });
  it('honors the shared import limit and missing configuration', async () => {
    mocks.send.mockRejectedValue(missing);
    mocks.acquire.mockResolvedValue(null);
    expect(await resolveOptimizedAudio('known', body)).toEqual({
      status: 'busy',
    });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    mocks.connection.mockReturnValue(null);
    expect(await resolveOptimizedAudio('known')).toEqual({
      status: 'disabled',
    });
  });
});
