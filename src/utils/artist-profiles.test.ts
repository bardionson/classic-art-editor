import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import snapshot from '@/data/artist-profiles.json';
import { getArchiveRecords } from '@/utils/archive-search';
import {
  artistHref,
  artistWorks,
  browseArtists,
  getArtistProfile,
  paginate,
  safeProfileUrl,
} from '@/utils/artist-profiles';

describe('restored artist profiles', () => {
  it('resolves an archived handle and wallet to the same identity, without fuzzy identity matching', () => {
    const bard = getArtistProfile('bardionson')!;
    expect(bard.address).toBe('0x01cb023186cab05220554ee75b4d69921dd051f1');
    expect(getArtistProfile(bard.address.toUpperCase())).toBe(bard);
    expect(getArtistProfile('bardion')).toBeUndefined();
    expect(getArtistProfile('burned')).toBeUndefined();
    expect(browseArtists('bard ionson').items).toContain(bard);
    expect(browseArtists(bard.address).total).toBe(1);
    for (const p of snapshot.profiles) {
      expect(
        getArtistProfile(
          decodeURIComponent(artistHref(p).slice('/artists/'.length)),
        )?.address,
      ).toBe(p.address);
    }
  });
  it('keeps Blueprint editions grouped by project and accounts for each linked work once', () => {
    for (const p of snapshot.profiles) {
      const works = artistWorks(p);
      expect(
        works.artworks.length +
          works.projects.reduce((n, project) => n + project.count, 0),
      ).toBe(p.works.length);
      expect(new Set(p.works.map((w) => w.recordId)).size).toBe(p.works.length);
    }
    expect(
      artistWorks(getArtistProfile('bardionson')!).artworks.some(
        (r) => r.name === 'Resting Place',
      ),
    ).toBe(true);
    expect(
      artistWorks(getArtistProfile('coldie')!).projects.length,
    ).toBeGreaterThan(0);
  });
  it('shows complete works without layers, stems or expansion items and preserves Blueprint projects', () => {
    let hidden = 0;
    let completeCount = 0;
    for (const profile of snapshot.profiles) {
      const all = artistWorks(profile);
      const complete = artistWorks(profile, 'complete');
      expect(complete.projects).toEqual(all.projects);
      expect(complete.total).toBe(all.total);
      expect(complete.artworks).toEqual(
        all.artworks.filter((r) => ['Master', 'Singleton'].includes(r.kind)),
      );
      hidden += all.artworks.length - complete.artworks.length;
      completeCount += complete.artworks.length;
    }
    expect(hidden).toBeGreaterThan(0);
    expect(completeCount).toBeGreaterThan(0);
    const bard = getArtistProfile('bardionson')!;
    expect(
      artistWorks(bard, 'complete').artworks.some(
        (r) => r.name === 'Resting Place',
      ),
    ).toBe(false);
    expect(
      artistWorks(bard, 'all').artworks.some((r) => r.name === 'Resting Place'),
    ).toBe(true);
  });
  it('ships only historical creators, source-backed identity data, and valid local portrait bytes', () => {
    const records = new Map(getArchiveRecords().map((r) => [r.id, r]));
    expect(new Set(snapshot.profiles.map((p) => p.address)).size).toBe(
      snapshot.profiles.length,
    );
    for (const p of snapshot.profiles) {
      expect(p.classification).toMatch(
        /^(historical-creator|metadata-linked-creator)$/,
      );
      expect(p.sourceUrl).toMatch(
        /^https:\/\/web\.archive\.org\/web\/\d{14}\//,
      );
      expect(p.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(p.captureTimestamp).toMatch(/^\d{14}$/);
      expect(p).not.toHaveProperty('intercomHash');
      expect(p).not.toHaveProperty('captures');
      if (p.portrait) {
        expect(p.portrait).toMatch(
          /^\/archive\/artists\/[a-f0-9]{24}(-display)?\.(png|jpg|jpeg|webp|gif)$/,
        );
        expect(existsSync(`public${p.portrait}`)).toBe(true);
        expect(
          createHash('sha256')
            .update(readFileSync(`public${p.portrait}`))
            .digest('hex'),
        ).toBe(p.portraitSha256);
      }
      for (const w of p.works) {
        const r = records.get(w.recordId)!;
        expect(r).toBeDefined();
        if (w.basis === 'metadata-wallet') {
          const meta = JSON.parse(
            readFileSync(`public/archive/metadata/${r.cid}.json`, 'utf8'),
          );
          expect(
            meta['async-attributes'].artists.map((a: string) =>
              a.toLowerCase(),
            ),
          ).toContain(p.address);
        } else if (w.basis === 'layer-contribution') {
          const layerRecordId = (w as { layerRecordId?: string }).layerRecordId;
          expect(
            p.works.some(
              (linked) =>
                linked.recordId === layerRecordId &&
                linked.basis !== 'layer-contribution',
            ),
          ).toBe(true);
          expect(r.kind).toBe('Master');
        } else expect(w.basis).toBe('archive-credit');
      }
    }
  });
  it('rejects active-content URLs, credentials, and unrelated social hosts', () => {
    for (const input of [
      'javascript:alert(1)',
      'data:text/html,<script>',
      '//evil.test',
      'https://user:password@example.com',
      'https://good.test\\@evil.test',
      'https://a.test\n',
    ]) {
      // Leading/trailing whitespace can be trimmed, but no executable scheme survives.
      if (!input.endsWith('\n')) expect(safeProfileUrl(input)).toBeNull();
    }
    expect(safeProfileUrl('bardionson.com')).toBe('https://bardionson.com/');
    expect(safeProfileUrl('@bardionson', 'twitter')).toBe(
      'https://x.com/bardionson',
    );
    expect(safeProfileUrl('https://twitter.com/bardionson', 'twitter')).toBe(
      'https://twitter.com/bardionson',
    );
    expect(
      safeProfileUrl('https://twitter.com.evil.test/name', 'twitter'),
    ).toBeNull();
    expect(safeProfileUrl('https://example.com', 'instagram')).toBeNull();
  });
  it('bounds directory and artwork pagination without overlap', () => {
    const a = browseArtists('', 1),
      b = browseArtists('', 2);
    expect(a.items).toHaveLength(24);
    expect(b.items.every((p) => !a.items.includes(p))).toBe(true);
    expect(browseArtists('', -5).page).toBe(1);
    expect(paginate([1, 2], Infinity).page).toBe(1);
    expect(paginate([1, 2], 100).items).toEqual([1, 2]);
  });
});
