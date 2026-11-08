import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getArchiveRecords, searchArchive } from './archive-search';
import { getBlueprintProject } from './blueprint-projects';
import catalog from '@/data/music-blueprint-projects.json';

const id = '629f959b98bb125d8871aa7f';
const report = JSON.parse(
  readFileSync(`public/archive/recovery/music-${id}.json`, 'utf8'),
);

describe('Senses collector editions', () => {
  it('indexes every minted token exactly once, using the actual edition contract', () => {
    expect(report.codeAtStart).toBe('0x');
    expect(report.mintedCount).toBe(717);
    const records = getArchiveRecords().filter((r) => r.blueprintId === id);
    expect(records).toHaveLength(717);
    expect(records.map((r) => Number(r.tokenId)).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 717 }, (_, i) => i),
    );
    expect(
      records.every(
        (r) =>
          r.contractAddress === '0x70a5a21d938c21de21ad7031830c85d4bee3feff' &&
          r.family === 'music-blueprints',
      ),
    ).toBe(true);
    expect(catalog.awaitingRecovery.some((p) => p.name === 'Senses')).toBe(
      false,
    );
    expect(getBlueprintProject(id)?.count).toBe(717);
  });
  it('preserves each original mix and image, with chain and file evidence', () => {
    for (const row of report.records) {
      const bytes = readFileSync(`public/archive/metadata/${row.cid}.json`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(row.sha256);
      const meta = JSON.parse(bytes.toString());
      expect(meta.external_url).toBe(
        `https://async.market/blueprints/${id}/editions/${report.contractAddress}-${row.tokenId}`,
      );
      expect(row.tokenURI).toBe(
        `ipfs://QmUc1PU8rsBSpeqePUA74pRPReXkY6KriLcrDuZ96NMH58/${row.tokenId}/token.json`,
      );
      expect(
        report.mintLogs.some(
          (l: { topics: string[] }) =>
            BigInt(l.topics[3]).toString() === row.tokenId,
        ),
      ).toBe(true);
      const result = searchArchive(
        `${report.contractAddress}:${row.tokenId}`,
        'music-blueprints',
      );
      expect(result.total).toBe(1);
      expect(result.results[0]).toMatchObject({
        cid: row.cid,
        image: meta.image,
        animationUrl: meta.animation_url,
        metadataLocal: true,
      });
    }
  });
});
