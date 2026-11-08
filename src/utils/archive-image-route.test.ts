import { beforeEach, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import sources from '@/data/archive-image-sources.json';
const mocks = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock('@/utils/r2-archive-images', async (original) => ({
  ...(await original<typeof import('./r2-archive-images')>()),
  resolveR2Image: mocks.resolve,
}));
import { GET, POST } from '@/app/api/archive/image/route';
const path = sources[0];
const request = (value = path) =>
  new NextRequest(
    `https://async.art/api/archive/image?path=${encodeURIComponent(value)}`,
  );
beforeEach(() => vi.resetAllMocks());
it('redirects cached originals without allowing the GET to import', async () => {
  mocks.resolve.mockResolvedValue({
    status: 'ready',
    url: 'https://storage.example.com/private-signed',
  });
  const response = await GET(request());
  expect(mocks.resolve).toHaveBeenCalledWith(path);
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe(
    'https://storage.example.com/private-signed',
  );
  expect(response.headers.get('cache-control')).toContain('no-store');
});
it('falls back to the exact Filebase original for missing or unavailable storage', async () => {
  for (const fail of [false, true]) {
    if (fail) mocks.resolve.mockRejectedValue(new Error('unavailable'));
    else mocks.resolve.mockResolvedValue({ status: 'missing' });
    const response = await GET(request());
    expect(response.headers.get('location')).toBe(
      'https://ipfs.filebase.io/ipfs/' + path,
    );
    expect(response.headers.get('cache-control')).toContain('no-store');
  }
});
it('warms through POST and exposes verified native MIME without proxying bytes', async () => {
  mocks.resolve.mockResolvedValue({
    status: 'ready',
    url: 'https://storage.example.com/private-signed',
    contentType: 'image/gif',
  });
  const response = await POST(request());
  expect(mocks.resolve).toHaveBeenCalledWith(path, true);
  expect((await response.json()).contentType).toBe('image/gif');
});
it('rejects unknown sibling paths and URLs before touching storage', async () => {
  for (const value of [
    path + '/other',
    'https://example.com/image.png',
    '__proto__',
  ]) {
    expect((await GET(request(value))).status).toBe(404);
    expect((await POST(request(value))).status).toBe(404);
  }
  expect(mocks.resolve).not.toHaveBeenCalled();
});
it('returns a generic failure without exposing SDK errors or credentials', async () => {
  mocks.resolve.mockRejectedValue(new Error('sensitive SDK context'));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ status: 'unavailable' });
});

it('honors the explicit original download flag', async () => {
  mocks.resolve.mockResolvedValue({
    status: 'ready',
    url: 'https://storage.example.com/original',
  });
  const response = await GET(new NextRequest(request().url + '&original=1'));
  expect(response.status).toBe(307);
  expect(mocks.resolve).toHaveBeenCalledWith(path, false, true);
});
