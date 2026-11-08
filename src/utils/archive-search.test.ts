import { describe, expect, it } from 'vitest';
import {
  searchArchive,
  archiveCoverage,
  getArchiveRecords,
  getArchiveRecordByCid,
} from './archive-search';

describe('archive-wide recovery search', () => {
  it('hides the reviewed earlier master while preserving its archive metadata and replacement', () => {
    expect(searchArchive('/v2/115').total).toBe(0);
    expect(searchArchive('/v2/245').total).toBe(1);
    const earlier =
      getArchiveRecords(true).find((r) => r.link?.startsWith('/v2/115?')) ??
      getArchiveRecords(true).find(
        (r) => r.tokenId === '115' && r.family === 'classic',
      );
    expect(earlier).toBeDefined();
    expect(getArchiveRecords()).not.toContain(earlier);
    expect(getArchiveRecordByCid(earlier!.cid)).toBeDefined();
  });
  it('deduplicates identities shared by the master and layer catalogs', () => {
    expect(searchArchive('/v2/1248').total).toBe(1);
    expect(searchArchive('/v2/1249').total).toBe(1);
  });
  it('looks up a contract-qualified artwork URL without unrelated token collisions', () => {
    const result = searchArchive(
      'https://www.async.art/v2/538?referrer=masters',
    );
    expect(result.total).toBe(1);
    expect(result.results[0].name).toBe('Mind Puzzle');
    expect(
      searchArchive('/v1/538').results.some((r) => r.link?.startsWith('/v2/')),
    ).toBe(false);
  });
  it('searches music and preserves source-qualified identities', () => {
    const result = searchArchive("Betty's Notebook", 'music');
    expect(
      result.results.some((r) => r.tokenId === '1592' && r.family === 'music'),
    ).toBe(true);
    expect(searchArchive('/v2/1592', 'classic').total).toBe(0);
  });
  it('finds recovered expansion metadata by exact case-sensitive CID', () => {
    const cid = 'QmccdgxmwtQDbajm6oAeofRAbz4PV6g2upACwA7qjqUm8w';
    const result = searchArchive('ipfs://' + cid);
    expect(result.total).toBe(1);
    expect(result.results[0]).toMatchObject({
      name: 'First Supper Forever',
      family: 'dynamic-blueprints',
      metadataVerified: true,
      link: null,
    });
    expect(searchArchive(cid.replace('ccdg', 'Ccdg')).total).toBe(0);
  });
  it('separates recovered production and test core identities', () => {
    const production = searchArchive(
      '0xf62d291a22886fa0b81e5b13c7b6dab2d4c33f31',
      'dynamic-blueprints',
    );
    const test = searchArchive(
      '0x3906a4f3d76b593a78081b2b059c32d2cb2bd26b',
      'dynamic-blueprints',
    );
    expect(production.total).toBe(1242);
    expect(test.total).toBe(26);
    expect(
      production.results.every(
        (r) =>
          r.metadataVerified &&
          r.metadataLocal &&
          r.image &&
          r.collection === 'Forever Supper',
      ),
    ).toBe(true);
    expect(
      test.results.every((r) => r.collection === 'Forever Supper (ProdTest)'),
    ).toBe(true);
  });
  it('finds expansions by their recovered slot while retaining exact identities', () => {
    const result = searchArchive('First Supper Forever', 'dynamic-blueprints')
      .results[0];
    expect(result.slot).toBe('Upper Wall (Left)');
    expect(
      searchArchive('Upper Wall Left', 'dynamic-blueprints').total,
    ).toBeGreaterThan(0);
  });
  it('indexes blueprint editions and searches reported contract/token pairs', () => {
    const result = searchArchive(
      '0x6da21c1c6d791670403b4d5d0e0747b38775a1d2:90',
      'blueprints',
    );
    expect(result.results.some((r) => r.name === 'Atemporal #10')).toBe(true);
    expect(
      result.results.every(
        (r) => r.link === null && r.identityStatus === 'reported',
      ),
    ).toBe(true);
  });
  it('bounds pagination and keeps unresolved records discoverable', () => {
    expect(archiveCoverage.total).toBeGreaterThan(14770);
    const all = searchArchive('', 'unclassified', Infinity);
    expect(all.total).toBeGreaterThan(0);
    expect(all.page).toBe(1);
    expect(all.results.length).toBeLessThanOrEqual(24);
    const last = searchArchive('', 'all', 999999);
    expect(last.page).toBe(last.totalPages);
  });
  it('supports normalized artist and multi-word searches', () => {
    expect(searchArchive('dailly', 'blueprints').total).toBeGreaterThan(0);
    expect(
      searchArchive('First Supper Forever', 'dynamic-blueprints').results[0]
        .name,
    ).toBe('First Supper Forever');
    expect(searchArchive('zzzznonexistent xxxx').total).toBe(0);
  });
});
