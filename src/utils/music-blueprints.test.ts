import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import catalog from '@/data/music-blueprint-projects.json';
import snapshot from '@/data/archive-index.json';
import recovered from '@/data/music-blueprint-metadata.json';
import {
  archiveCoverage,
  getArchiveRecordByCid,
  getBlueprintRecords,
  searchArchive,
} from '@/utils/archive-search';
import {
  browseBlueprintProjects,
  getBlueprintProject,
  groupBlueprintProjects,
} from '@/utils/blueprint-projects';
import { archiveFamilies } from '@/utils/archive-families';

describe('Music Blueprint archive category', () => {
  it('partitions every Blueprint edition once without changing identities or the total inventory', () => {
    const music = browseBlueprintProjects('', 'name', 1, 'music-blueprints');
    const visual = browseBlueprintProjects('', 'name', 1, 'blueprints');
    expect(music.allProjects).toBe(21);
    expect(music.editions).toBe(1673);
    expect(music.allProjects + visual.allProjects).toBe(201);
    expect(music.editions + visual.editions).toBe(9065);
    expect(archiveCoverage.total).toBe(snapshot.records.length);
    expect(
      Object.values(archiveCoverage.counts).reduce((a, b) => a + b, 0),
    ).toBe(snapshot.records.length);
    expect(archiveCoverage.counts['music-blueprints']).toBe(music.editions);
    expect(
      music.projects.every((p) => !visual.projects.some((v) => v.id === p.id)),
    ).toBe(true);
    expect(new Set(getBlueprintRecords().map((r) => r.id)).size).toBe(9065);
  });
  it('includes every recovered edition on the shared music contract', () => {
    const contractRecords = snapshot.records.filter(
      (r) => r.contractAddress.toLowerCase() === catalog.sharedContract.address,
    );
    expect(contractRecords).toHaveLength(48);
    for (const record of contractRecords) {
      const resolved = getArchiveRecordByCid(record.cid)!;
      expect(resolved.family).toBe('music-blueprints');
      expect(resolved.tokenId).toBe(record.tokenId);
      expect(resolved.contractAddress).toBe(record.contractAddress);
    }
    expect(getBlueprintProject('631c8c13df536872b28161fb')?.name).toBe(
      'Better Way',
    );
    expect(getBlueprintProject('6311454f489bfeffacbb1f07')?.name).toBe(
      'Slip Away',
    );
    expect(
      searchArchive('Better Way', 'music-blueprints').results[0]?.tokenId,
    ).toBe('13855');
  });
  it('finds original project names and keeps master music and ordinary Blueprints separate', () => {
    for (const [query, count] of [
      ['WHATEVER', 2],
      ['Element', 5],
      ['H0m3w0rk', 12],
    ] as const) {
      const result = searchArchive(query, 'music-blueprints');
      expect(result.results.filter((r) => r.collection === query)).toHaveLength(
        count,
      );
      expect(result.results.every((r) => r.family === 'music-blueprints')).toBe(
        true,
      );
    }
    expect(
      browseBlueprintProjects('kena', 'name', 1, 'music-blueprints').total,
    ).toBe(2);
    expect(searchArchive("Betty's Notebook", 'music-blueprints').total).toBe(0);
    expect(searchArchive('/v2/1592', 'music').total).toBe(1);
    expect(getBlueprintProject('630238eee754e2f239717892')?.family).toBe(
      'blueprints',
    ); // Disc title alone is insufficient.
    expect(getBlueprintProject('63ed3b9f82b726f72c162d7e')?.family).toBe(
      'blueprints',
    ); // Animation alone is insufficient.
    expect(archiveFamilies.some((f) => f.id === 'music-blueprints')).toBe(true);
  });
  it('retains canonical project and metadata lookups and narrows pagination to the project', () => {
    const project = getBlueprintProject('63d6f5db3c0cbf340f528699')!;
    const first = searchArchive('', project.family, 1, 'all', project.id);
    const second = searchArchive('', project.family, 2, 'all', project.id);
    expect(first.total).toBe(1453);
    expect(first.results).toHaveLength(24);
    expect(
      second.results.every(
        (r) =>
          r.blueprintId === project.id &&
          !first.results.some((p) => p.id === r.id),
      ),
    ).toBe(true);
    expect(searchArchive('', 'blueprints', 1, 'all', project.id).total).toBe(0);
    for (const row of first.results)
      expect(getArchiveRecordByCid(row.cid)?.family).toBe('music-blueprints');
  });
  it('requires project evidence and limits restored metadata to the exact verified edition CID', () => {
    expect(new Set(catalog.projects.map((p) => p.id)).size).toBe(
      catalog.projects.length,
    );
    for (const project of catalog.projects) {
      expect(getBlueprintProject(project.id)).toBeDefined();
      expect(project.evidenceUrl).toMatch(/^https:\/\//);
      expect(project.basis.length).toBeGreaterThan(30);
    }
    for (const [cid, supplement] of Object.entries(recovered)) {
      const raw = JSON.parse(
        readFileSync(`public/archive/metadata/${cid}.json`, 'utf8'),
      );
      const record = getArchiveRecordByCid(cid)!;
      expect(record.image).toBe(raw.image);
      expect(record.description).toBe(raw.description);
      expect(record.metadataLocal).toBe(true);
      expect(supplement.metadataVerified).toBe(true);
    }
    const element = searchArchive(
      '',
      'music-blueprints',
      1,
      'all',
      '62c77539c679226473b4dd29',
    );
    expect(element.results.every((r) => !r.metadataLocal)).toBe(true);
    const grouped = groupBlueprintProjects(getBlueprintRecords());
    expect(grouped.filter((p) => p.family === 'music-blueprints')).toHaveLength(
      21,
    );
  });
});
