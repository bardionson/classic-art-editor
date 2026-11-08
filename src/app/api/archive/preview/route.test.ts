import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { getArchiveRecords } from '@/utils/archive-search';
const cid = 'QmccdgxmwtQDbajm6oAeofRAbz4PV6g2upACwA7qjqUm8w';
const pending = getArchiveRecords().find(
  (r) => r.family === 'blueprints' && !r.metadataVerified && r.cid,
)!;
const request = (value = pending.cid) =>
  new NextRequest(
    `https://async.art/api/archive/preview?cid=${encodeURIComponent(value)}`,
  );
afterEach(() => vi.unstubAllGlobals());
describe('archive preview metadata route', () => {
  it('uses preserved verified metadata without another gateway request', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const response = await GET(request(cid));
    expect(response.status).toBe(200);
    expect((await response.json()).image).toBe(
      'ipfs://QmYfy2qQBceBghoQGTsLUXpqZibbmoN11eTaDMPAkAAkUe',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects unindexed IDs without making network requests', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect((await GET(request('https://localhost/private'))).status).toBe(404);
    expect((await GET(request('Qm' + '1'.repeat(44)))).status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('fails over a gateway error and returns only a validated image reference', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('Busy', { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ image: `ipfs://${cid}`, dangerous: 'ignored' }),
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    const result = await GET(request());
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ image: `ipfs://${cid}` });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not fabricate a preview when metadata is missing or oversized', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(new Response('x'.repeat(2_000_001))),
        ),
    );
    const result = await GET(request());
    expect(result.status).toBe(503);
    expect((await result.json()).image).toBeNull();
  });
});
