import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getArchiveRecords, searchArchive } from './archive-search';
import { getBlueprintProject } from './blueprint-projects';

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const audit = read('public/archive/recovery/music-shared-contracts.json');

describe('complete shared Music Blueprint mint inventory', () => {
  it('includes exactly the 4002 distinct mints across both contracts, including token zero and gaps', () => {
    const records = getArchiveRecords();
    expect(audit.deploymentChecks).toHaveLength(2);
    expect(
      audit.deploymentChecks.every((r: { code: string }) => r.code === '0x'),
    ).toBe(true);
    expect(
      audit.contracts.map((c: { mintedCount: number }) => c.mintedCount),
    ).toEqual([621, 3381]);
    for (const contract of audit.contracts) {
      const editions = records.filter(
        (r) => r.contractAddress === contract.address,
      );
      expect(editions.every((r) => r.family === 'music-blueprints')).toBe(true);
      expect(
        editions.map((r) => Number(r.tokenId)).sort((a, b) => a - b),
      ).toEqual(contract.tokenIds);
      expect(new Set(editions.map((r) => r.tokenId)).size).toBe(
        contract.mintedCount,
      );
      expect(contract.tokenIds).toContain(0);
    }
    expect(audit.tokenURIs).toHaveLength(4002);
  });

  it('preserves exact original bytes and project identities for all 1002 non-Dream editions', () => {
    const seen = new Set<string>();
    for (const reportUrl of audit.recoveredProjectReports) {
      const report = read(`public${reportUrl}`);
      const project = getBlueprintProject(report.projectId)!;
      expect(project.count).toBe(report.mintedCount);
      expect(project.name).toBe(report.name);
      expect(report.records).toHaveLength(report.mintedCount);
      for (const item of report.records) {
        const bytes = readFileSync(`public/archive/metadata/${item.cid}.json`);
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(
          item.sha256,
        );
        const metadata = JSON.parse(bytes.toString('utf8'));
        expect(metadata.external_url).toBe(
          `https://async.market/blueprints/${report.projectId}/editions/${report.contractAddress}-${item.tokenId}`,
        );
        const found = searchArchive(
          `${report.contractAddress}:${item.tokenId}`,
          'music-blueprints',
        );
        expect(found.total).toBe(1);
        expect(found.results[0]).toMatchObject({
          cid: item.cid,
          blueprintId: report.projectId,
          image: metadata.image,
          animationUrl: metadata.animation_url ?? '',
          metadataLocal: true,
        });
        expect(
          report.mintLogs.some(
            (log: { topics: string[] }) =>
              BigInt(log.topics[3]).toString() === item.tokenId,
          ),
        ).toBe(true);
        const key = `${report.contractAddress}:${item.tokenId}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(seen.size).toBe(1002);
  });

  it('restores Binaural as a launched collection, with actual mints rather than its maximum supply', () => {
    const id = '6371cf4d63a45b33fbb2d8d2';
    expect(getBlueprintProject(id)).toMatchObject({
      name: 'Binaural BrainWave Machine',
      count: 155,
      family: 'music-blueprints',
    });
    const result = searchArchive('', 'music-blueprints', 7, 'all', id);
    expect(result.total).toBe(155);
    expect(result.results).toHaveLength(11);
    expect(result.results.every((r) => r.blueprintId === id)).toBe(true);
  });
});
