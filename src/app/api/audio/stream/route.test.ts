import { beforeEach, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ original: vi.fn(), optimized: vi.fn() }));
vi.mock('@/utils/r2-audio', () => ({
  allowedAudio: (path: string) => ['known', 'legacy'].includes(path),
  resolveR2Audio: mocks.original,
}));
vi.mock('@/utils/r2-optimized-audio', () => ({
  optimizedAudio: (path: string) => path === 'known',
  resolveOptimizedAudio: mocks.optimized,
}));
import { GET } from './route';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.original.mockResolvedValue({
    status: 'ready',
    url: 'https://storage.example/original.wav',
  });
});
const request = (path: string) =>
  new NextRequest(
    'https://www.async.art/api/audio/stream?path=' + encodeURIComponent(path),
  );
it('automatically streams the optimized copy when available', async () => {
  mocks.optimized.mockResolvedValue({
    status: 'ready',
    url: 'https://storage.example/copy.m4a',
  });
  const response = await GET(request('known'));
  expect(response.status).toBe(307);
  expect(response.headers.get('Location')).toBe(
    'https://storage.example/copy.m4a',
  );
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(mocks.original).not.toHaveBeenCalled();
});
it('retains the original fallback on absent or failed derivative storage', async () => {
  mocks.optimized
    .mockResolvedValueOnce({ status: 'missing' })
    .mockRejectedValueOnce(new Error('storage unavailable'));
  for (let i = 0; i < 2; i++)
    expect((await GET(request('known'))).headers.get('Location')).toBe(
      'https://storage.example/original.wav',
    );
});
it('leaves other archive audio on its existing route and rejects unknown sources', async () => {
  expect((await GET(request('legacy'))).headers.get('Location')).toBe(
    'https://storage.example/original.wav',
  );
  expect((await GET(request('https://example.com/private'))).status).toBe(404);
  expect(mocks.optimized).not.toHaveBeenCalled();
  expect(mocks.original).toHaveBeenCalledTimes(1);
});
