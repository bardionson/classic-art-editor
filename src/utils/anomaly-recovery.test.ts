import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { getArchiveRecords, searchArchive } from '@/utils/archive-search';
import { getBlueprintProject } from '@/utils/blueprint-projects';
import { artistWorks, getArtistProfile } from '@/utils/artist-profiles';

const id = '623004fd64432b9d749651cc';
const contract = '0xc143bbfcdbdbed6d454803804752a064a622c1f3';
const evidence = JSON.parse(
  readFileSync('public/archive/recovery/sage-anomaly.json', 'utf8'),
);

describe('SAGE Anomaly edition recovery', () => {
  it('indexes every audited mint with original metadata, including specially titled editions', () => {
    const records = getArchiveRecords().filter((r) => r.blueprintId === id);
    expect(records).toHaveLength(97);
    expect(new Set(records.map((r) => r.tokenId)).size).toBe(97);
    expect(evidence.records).toHaveLength(97);
    expect(evidence.mintLogs).toHaveLength(97);
    expect(evidence.declaredEditionCount).toBe(303);
    for (const entry of evidence.records) {
      const r = records.find((r) => r.tokenId === entry.tokenId)!;
      expect(r).toMatchObject({
        cid: entry.cid,
        image: entry.image,
        metadataLocal: true,
        metadataVerified: true,
        contractAddress: contract,
        identityStatus: 'verified',
      });
      const bytes = readFileSync(`public/archive/metadata/${entry.cid}.json`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        entry.sha256,
      );
      const metadata = JSON.parse(bytes.toString());
      expect(r.name).toBe(metadata.name);
      expect(metadata.external_url).toBe(
        `https://async.market/blueprints/${id}/editions/${contract}-${entry.tokenId}`,
      );
      const log = evidence.mintLogs.find(
        (l: { data: string }) =>
          BigInt('0x' + l.data.slice(194, 258)).toString() === entry.tokenId,
      );
      expect(log.address).toBe(contract);
      expect(log.topics[0]).toBe(evidence.eventTopic);
      expect(BigInt('0x' + log.data.slice(2, 66))).toBe(BigInt(104));
      expect(log.transactionHash).toBe(metadata['async-attributes'].txHash);
    }
    expect(records.map((r) => r.name)).toContain('The Reality Of The Entity');
    expect(records.map((r) => r.name)).toContain('Unidentified Words');
    expect(getBlueprintProject(id)?.name).toBe('SAGE Anomaly');
    expect(
      artistWorks(getArtistProfile('bardionson')!).projects.find(
        (p) => p.id === id,
      )?.count,
    ).toBe(97);
  });
  it('makes all recovered editions reachable across five pages and exact token searches', () => {
    const pages = Array.from({ length: 5 }, (_, i) =>
      searchArchive('', 'blueprints', i + 1, 'all', id),
    );
    expect(pages.every((p) => p.total === 97 && p.totalPages === 5)).toBe(true);
    const records = pages.flatMap((p) => p.results);
    expect(records).toHaveLength(97);
    expect(new Set(records.map((r) => r.id)).size).toBe(97);
    expect(
      searchArchive(`${contract}:58158`, 'blueprints').results[0].name,
    ).toBe('Anomaly #000');
    expect(
      searchArchive('The Reality Of The Entity', 'blueprints', 1, 'all', id)
        .total,
    ).toBe(1);
    expect(records.some((r) => r.name.startsWith('Spin'))).toBe(false);
  });
});
