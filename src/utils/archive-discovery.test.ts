import { describe, expect, it } from 'vitest';
import {
  searchArchive,
  displayStatus,
  getArchiveRecordByCid,
} from './archive-search';

describe('illustrated unified discovery', () => {
  it('includes actual catalog images and recovered Blueprint image references', () => {
    expect(searchArchive('/v2/1597').results[0].image).toBeTruthy();
    const blueprint = searchArchive('Atemporal #10', 'blueprints').results.find(
      (r) => r.name === 'Atemporal #10',
    )!;
    expect(blueprint.image).toBe(
      'ipfs://QmXXknLZg5gDacWFM171U68TQrYL1mt2zTieUcKUN4GYbD',
    );
    expect(blueprint.metadataVerified).toBe(true);
    expect(displayStatus(blueprint)).toBe('preview');
    expect(blueprint.link).toBeNull();
  });
  it('recognizes layer URLs and artwork URLs with trailing slashes', () => {
    expect(
      searchArchive('https://async.art/v2/538/?referrer=masters').results[0]
        .name,
    ).toBe('Mind Puzzle');
    const result = searchArchive(
      'https://async.art/layer/0xb6dae651468e9593e4581705a09c10a76ac1e0c8/1?referrer=search',
    );
    expect(result.total).toBe(1);
    expect(result.results[0].name).toBe('Wallpaper');
  });
  it('keeps numeric token collisions visible and qualifies them by family or contract', () => {
    const all = searchArchive('90');
    expect(all.total).toBeGreaterThan(1);
    expect(
      searchArchive('90', 'classic').results.every(
        (r) => r.family === 'classic',
      ),
    ).toBe(true);
    expect(
      searchArchive(
        '0x6da21c1c6d791670403b4d5d0e0747b38775a1d2:90',
      ).results.every(
        (r) =>
          r.contractAddress === '0x6da21c1c6d791670403b4d5d0e0747b38775a1d2',
      ),
    ).toBe(true);
  });
  it('finds indexed image CIDs but never lowercases CIDv0', () => {
    const cid = 'QmccdgxmwtQDbajm6oAeofRAbz4PV6g2upACwA7qjqUm8w';
    expect(searchArchive(cid.toLowerCase()).total).toBe(0);
    expect(
      searchArchive(
        'ipfs://QmYfy2qQBceBghoQGTsLUXpqZibbmoN11eTaDMPAkAAkUe',
      ).results.some((r) => r.cid === cid),
    ).toBe(true);
    expect(getArchiveRecordByCid(cid)?.metadataVerified).toBe(true);
  });
  it('filters indexed recovery stages without claiming metadata verification restores behavior', () => {
    for (const status of ['artwork', 'preview', 'metadata']) {
      const found = searchArchive('', 'all', 2, status);
      expect(found.results.length).toBeGreaterThan(0);
      expect(found.results.every((r) => displayStatus(r) === status)).toBe(
        true,
      );
    }
    const record = getArchiveRecordByCid(
      'QmccdgxmwtQDbajm6oAeofRAbz4PV6g2upACwA7qjqUm8w',
    )!;
    expect(displayStatus({ ...record, image: undefined })).toBe('metadata');
  });
  it('normalizes punctuation and reports cross-collection counts before narrowing', () => {
    expect(
      searchArchive('betty’s notebook', 'music').results.some(
        (r) => r.tokenId === '1592',
      ),
    ).toBe(true);
    const found = searchArchive('supper', 'classic');
    expect(found.familyCounts['dynamic-blueprints']).toBeGreaterThan(0);
    expect(found.results.every((r) => r.family === 'classic')).toBe(true);
  });
});
