import { afterEach, describe, expect, it, vi } from 'vitest';
import { audioCacheKey, prepareAudio } from './audio-cache';
import { sharedAudioUrl } from './audio-delivery';

vi.mock('./audio-delivery', () => ({
  sharedAudioUrl: vi.fn(async () => null),
}));

const cid = 'QmPGChtKCG4rFxv3qN1zKRC9zqn8UQvpvJcDUHwVwEAgRL';
function cacheMock(failWrite = false) {
  const values = new Map<string, Response>();
  const cache = {
    keys: async () => Array.from(values.keys()).map((key) => new Request(key)),
    match: async (key: string | Request) =>
      values.get(typeof key === 'string' ? key : key.url)?.clone(),
    delete: async (key: string | Request) =>
      values.delete(typeof key === 'string' ? key : key.url),
    put: vi.fn(async (key: string, value: Response) => {
      if (failWrite) throw new Error('Quota exceeded');
      values.set(key, value);
    }),
  };
  vi.stubGlobal('caches', { open: async () => cache });
  return { cache, values };
}
const mp3 = () =>
  new Response(new Uint8Array([73, 68, 51, 0]), {
    headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': '4' },
  });
afterEach(() => vi.unstubAllGlobals());

describe('complete audio cache', () => {
  it('reuses the same immutable file across gateways without another download', async () => {
    cacheMock();
    const fetcher = vi.fn(async () => mp3());
    vi.stubGlobal('fetch', fetcher);
    const first = await prepareAudio(
      `ipfs://${cid}`,
      new AbortController().signal,
    );
    expect(first.saved).toBe(true);
    const second = await prepareAudio(
      `https://ipfs.io/ipfs/${cid}`,
      new AbortController().signal,
    );
    expect(second.cached).toBe(true);
    expect(await second.blob.arrayBuffer()).toEqual(
      await first.blob.arrayBuffer(),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not merge different files inside one CID', () => {
    expect(audioCacheKey(`ipfs://${cid}/a.mp3`)).not.toEqual(
      audioCacheKey(`ipfs://${cid}/b.mp3`),
    );
    expect(audioCacheKey(`ipfs://${cid}/%2e%2e/a`)).toBeNull();
  });
  it('rejects gateway HTML and partial responses before caching a complete alternative', async () => {
    const { cache } = cacheMock();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('<html>error</html>', {
          headers: { 'Content-Type': 'text/html' },
        }),
      )
      .mockResolvedValueOnce(new Response('partial', { status: 206 }))
      .mockResolvedValueOnce(mp3());
    vi.stubGlobal('fetch', fetcher);
    const result = await prepareAudio(
      `ipfs://${cid}`,
      new AbortController().signal,
    );
    expect(result.blob.size).toBe(4);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(cache.put).toHaveBeenCalledTimes(1);
  });
  it('keeps playback usable when persistent browser storage is unavailable', async () => {
    cacheMock(true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mp3()),
    );
    const result = await prepareAudio(
      `ipfs://${cid}`,
      new AbortController().signal,
    );
    expect(result.saved).toBe(false);
    expect(result.blob.size).toBe(4);
  });
  it('aborts without saving a partially downloaded file', async () => {
    const { cache } = cacheMock();
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        controller.abort();
        throw new DOMException('cancelled', 'AbortError');
      }),
    );
    await expect(
      prepareAudio(`ipfs://${cid}`, controller.signal),
    ).rejects.toThrow();
    expect(cache.put).not.toHaveBeenCalled();
  });
  it('evicts old audio before crossing the cache budget', async () => {
    const { values } = cacheMock();
    values.set(
      'https://async.art/__audio-cache/old',
      new Response('old', {
        headers: { 'x-audio-bytes': String(256 * 1024 * 1024) },
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => mp3()),
    );
    await prepareAudio(`ipfs://${cid}`, new AbortController().signal);
    expect(values.has('https://async.art/__audio-cache/old')).toBe(false);
  });
});

it('falls back to IPFS when the signed R2 download is blocked by CORS or expires', async () => {
  cacheMock();
  vi.mocked(sharedAudioUrl).mockResolvedValueOnce(
    'https://test.r2.cloudflarestorage.com/audio?signature=test',
  );
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce(mp3());
  vi.stubGlobal('fetch', fetcher);
  const first = await prepareAudio(
    `ipfs://${cid}`,
    new AbortController().signal,
  );
  expect(first.saved).toBe(true);
  expect(fetcher.mock.calls[0][0]).toContain('r2.cloudflarestorage.com');
  expect(fetcher.mock.calls[1][0]).toContain('/ipfs/');
  const second = await prepareAudio(
    `ipfs://${cid}`,
    new AbortController().signal,
  );
  expect(second.cached).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
