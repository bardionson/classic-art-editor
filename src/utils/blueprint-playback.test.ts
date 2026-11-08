import { describe, expect, it, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import * as archiveSearch from '@/utils/archive-search';
import { metadataPlayback } from '@/utils/archive-media';
import { GET } from '@/app/api/archive/preview/route';
import recovered from '@/data/music-blueprint-metadata.json';
import audioSources from '@/data/archive-audio-sources.json';
import mediaTypes from '@/data/archive-media-types.json';
import mediaGaps from '@/data/music-blueprint-media-gaps.json';

const cid = 'QmXbUf3Zpaa8RBBQABhaTXwHmyLp9TzPqTxc89ac1D4o46';
const request = (value: string) =>
  new NextRequest(`https://async.art/api/archive/preview?cid=${value}`);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// This edition is now recovered. Model the pre-recovery state explicitly so
// fallback tests remain independent of a growing production archive.
function unrecoveredFixture() {
  const record = archiveSearch.getArchiveRecordByCid(
    'QmRuwNf91D6hdDBNXs1PQr7aCGK4xCx5iV2yvXsK4xhg79',
  )!;
  vi.spyOn(archiveSearch, 'getArchiveRecordByCid').mockReturnValue({
    ...record,
    animationUrl: undefined,
  });
}

describe('Music Blueprint edition playback', () => {
  it('preserves the exact audio of each recovered edition, rather than sharing a project mix', () => {
    const sources = new Set<string>();
    for (const [key, row] of Object.entries(recovered)) {
      const original = JSON.parse(
        readFileSync(`public/archive/metadata/${key}.json`, 'utf8'),
      );
      expect(row.animationUrl).toBe(original.animation_url ?? '');
      if (!row.animationUrl) {
        expect(metadataPlayback(original)).toBeNull();
        continue;
      }
      const gap = (mediaGaps as Record<string, { status: string }>)[key];
      if (gap?.status === 'gateway-unavailable') {
        // Preserve the original URI without claiming its unobserved media format.
        expect(metadataPlayback(original)?.source).toBe(row.animationUrl);
        sources.add(row.animationUrl);
        continue;
      }
      expect(metadataPlayback(original)).toEqual({
        source: row.animationUrl,
        kind:
          row.animationUrl.endsWith('.mp4') ||
          (mediaTypes as Record<string, { contentType: string }>)[
            row.animationUrl.replace('ipfs://', '')
          ]?.contentType.startsWith('video/')
            ? 'video'
            : 'audio',
      });
      if (row.animationUrl.startsWith('ipfs://')) {
        const path = row.animationUrl.slice(7);
        expect(
          (audioSources as Record<string, { metadata: string }[]>)[path],
        ).toContainEqual({
          metadata: `ipfs://${key}`,
          family: 'music-blueprints',
        });
        expect(
          (mediaTypes as Record<string, { contentType: string }>)[path]
            ?.contentType,
        ).toMatch(/^(audio|video)\//);
      }
      sources.add(row.animationUrl);
    }
    expect(sources.size).toBe(
      new Set(
        Object.values(recovered)
          .map((r) => r.animationUrl)
          .filter(Boolean),
      ).size,
    );
    expect(sources.size).toBeGreaterThan(200);
  });
  it('serves preserved media while metadata gateways are offline', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const response = await GET(request(cid));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.media).toEqual({
      source: recovered[cid].animationUrl,
      kind: 'audio',
    });
    expect(data.image).toBe(recovered[cid].image);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('resolves another edition’s original mix on demand, with gateway fallback', async () => {
    unrecoveredFixture();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('Busy', { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            animation_url: 'https://example.com/edition-60.mp3',
            image: 'https://example.com/edition-60.png',
          }),
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    const response = await GET(
      request('QmRuwNf91D6hdDBNXs1PQr7aCGK4xCx5iV2yvXsK4xhg79'),
    );
    expect(await response.json()).toEqual({
      image: 'https://example.com/edition-60.png',
      media: { source: 'https://example.com/edition-60.mp3', kind: 'audio' },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('handles explicit audio and video without mistaking a poster or web player for audio', () => {
    expect(metadataPlayback({ audio_url: `ipfs://${cid}` })).toEqual({
      source: `ipfs://${cid}`,
      kind: 'audio',
    });
    expect(
      metadataPlayback({ animation_url: 'https://example.com/edition.mp4' })
        ?.kind,
    ).toBe('video');
    expect(metadataPlayback({ animation_url: `ipfs://${cid}` })?.kind).toBe(
      'video',
    );
    for (const source of [
      'javascript:alert(1)',
      'data:text/html,test',
      'https://localhost/audio',
      'https://example.com/player.html',
      'https://example.com/poster.png',
      `ipfs://${cid}/../private`,
    ]) {
      expect(metadataPlayback({ animation_url: source })).toBeNull();
    }
    expect(metadataPlayback({ image: `ipfs://${cid}` })).toBeNull();
    expect(
      metadataPlayback({
        attributes: [{ trait_type: 'music', value: 'a stem name' }],
      }),
    ).toBeNull();
  });
  it('reports missing audio rather than substituting another edition', async () => {
    unrecoveredFixture();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ image: `ipfs://${cid}` })),
        ),
    );
    const response = await GET(
      request('QmRuwNf91D6hdDBNXs1PQr7aCGK4xCx5iV2yvXsK4xhg79'),
    );
    expect((await response.json()).media).toBeNull();
  });
});
