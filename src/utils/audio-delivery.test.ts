import { afterEach, it, expect, vi } from 'vitest';
import { sharedAudioUrl, archiveAudioUrl } from './audio-delivery';
const cid = 'QmPGChtKCG4rFxv3qN1zKRC9zqn8UQvpvJcDUHwVwEAgRL';
afterEach(() => vi.unstubAllGlobals());
it('requests an archive copy using the immutable path and accepts only an R2 HTTPS URL', async () => {
  const url =
    'https://55970efa14ced9af016c3f41d994fd81.r2.cloudflarestorage.com/asyncart/audio?signature=test';
  const fetcher = vi.fn(async (_url: string) =>
    Response.json({ status: 'ready', url }),
  );
  vi.stubGlobal('fetch', fetcher);
  expect(
    await sharedAudioUrl(`ipfs://${cid}`, new AbortController().signal),
  ).toBe(url);
  expect(fetcher.mock.calls[0][0]).toBe(`/api/audio?path=${cid}`);
  expect(archiveAudioUrl(`ipfs://${cid}/file.wav`)).toBe(
    `/api/audio/stream?path=${cid}%2Ffile.wav`,
  );
});
it('allows IPFS fallback for unavailable storage and rejects injected URLs', async () => {
  for (const data of [
    { status: 'disabled' },
    { status: 'busy' },
    { status: 'ready', url: 'https://evil.example/audio' },
  ]) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(data)),
    );
    expect(await sharedAudioUrl(cid, new AbortController().signal)).toBeNull();
  }
});
it('propagates cancellation instead of continuing to download', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('cancelled');
    }),
  );
  await expect(sharedAudioUrl(cid, AbortSignal.abort())).rejects.toThrow();
});
