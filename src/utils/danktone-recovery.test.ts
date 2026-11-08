import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import snapshot from '@/data/archive-index.json';
import { getArchiveRecordByCid } from '@/utils/archive-search';
import { getBlueprintProject } from '@/utils/blueprint-projects';

type RecoveryRecord = {
  recordId: string;
  projectId: string;
  collection: string;
  name: string;
  artist: string;
  contractAddress: string;
  tokenId: string;
  cid: string;
  metadataUri: string;
  tokenURI?: string;
  directoryCid?: string;
  externalUrl: string;
  externalUrlMatchesManifestIdentity: boolean;
  identityStatus: 'reported' | 'verified';
  animationUrl?: string;
  verification: { sha256: string; bytes: number };
};

const report = JSON.parse(
  readFileSync('public/archive/recovery/danktone-metadata.json', 'utf8'),
) as { records: RecoveryRecord[] };
const audioSources = JSON.parse(
  readFileSync('src/data/archive-audio-sources.json', 'utf8'),
) as Record<string, { metadata: string; family: string }[]>;
const coverage = JSON.parse(
  readFileSync('src/data/blueprint-project-coverage.json', 'utf8'),
) as Record<string, { mintedCount: number }>;

const varint = (number: number) => {
  const bytes: number[] = [];
  while (number >= 128) {
    bytes.push((number & 127) | 128);
    number >>= 7;
  }
  bytes.push(number);
  return Buffer.from(bytes);
};

const base58 = (bytes: Buffer) => {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = BigInt(`0x${bytes.toString('hex')}`);
  let encoded = '';
  while (value > BigInt(0)) {
    const rem = Number(value % BigInt(58));
    encoded = alphabet[rem] + encoded;
    value /= BigInt(58);
  }
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  return '1'.repeat(zeros) + encoded;
};

const cidV0 = (bytes: Buffer) => {
  const unixfsData = Buffer.concat([
    Buffer.from([0x08, 0x02, 0x12]),
    varint(bytes.length),
    bytes,
    Buffer.from([0x18]),
    varint(bytes.length),
  ]);
  const node = Buffer.concat([
    Buffer.from([0x0a]),
    varint(unixfsData.length),
    unixfsData,
  ]);
  const multihash = Buffer.concat([
    Buffer.from([0x12, 0x20]),
    createHash('sha256').update(node).digest(),
  ]);
  return base58(multihash);
};

const ipfsPath = (uri?: string) => {
  if (!uri) return undefined;
  return uri.match(
    /^(?:ipfs:\/\/)?(Qm[1-9A-HJ-NP-Za-km-z]{44}(?:\/[^\s]*)?)$/,
  )?.[1];
};

describe('Danktone metadata recovery merge', () => {
  it('preserves and verifies every staged original metadata byte and edition identity', () => {
    expect(report.records).toHaveLength(1816);
    expect(new Set(report.records.map((row) => row.cid)).size).toBe(1816);

    const identities = new Set<string>();
    for (const row of report.records) {
      const key = `${row.contractAddress.toLowerCase()}:${row.tokenId}`;
      expect(identities.has(key)).toBe(false);
      identities.add(key);

      const bytes = readFileSync(`public/archive/metadata/${row.cid}.json`);
      expect(bytes.byteLength).toBe(row.verification.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        row.verification.sha256,
      );
      expect(cidV0(bytes)).toBe(row.cid);
      const metadata = JSON.parse(bytes.toString('utf8'));
      expect(metadata.name).toBe(row.name);
      expect(metadata.external_url).toBe(row.externalUrl);
      expect(row.externalUrlMatchesManifestIdentity).toBe(true);
      expect(metadata.image).toBeDefined();
      expect(metadata.animation_url ?? '').toBe(row.animationUrl ?? '');

      const rawIndexRecord = snapshot.records.find(
        (record) => record.cid === row.cid,
      );
      expect(rawIndexRecord).toMatchObject({
        contractAddress: row.contractAddress,
        tokenId: row.tokenId,
        blueprintId: row.projectId,
        family: 'blueprints',
        cid: row.cid,
      });
      expect(rawIndexRecord?.identityStatus).toBe(row.identityStatus);

      const archiveRecord = getArchiveRecordByCid(row.cid);
      expect(archiveRecord).toMatchObject({
        family: 'music-blueprints',
        blueprintId: row.projectId,
        cid: row.cid,
        image: metadata.image,
        animationUrl: metadata.animation_url ?? undefined,
        metadataLocal: true,
        metadataVerified: true,
      });

      const mediaPath = ipfsPath(row.animationUrl);
      if (mediaPath) {
        expect(audioSources[mediaPath]).toContainEqual({
          metadata: `ipfs://${row.cid}`,
          family: 'music-blueprints',
        });
      }
    }
  });

  it('keeps manifest-only identity reported and verifies only the 26 tokenURI extras', () => {
    const counts = report.records.reduce<Record<string, number>>(
      (result, row) => {
        result[row.identityStatus] = (result[row.identityStatus] ?? 0) + 1;
        return result;
      },
      {},
    );
    expect(counts).toEqual({ reported: 1790, verified: 26 });
    const extras = report.records.filter(
      (row) => row.identityStatus === 'verified',
    );
    expect(extras).toHaveLength(26);
    for (const row of extras) {
      expect(row.tokenURI).toBe(
        `ipfs://${row.directoryCid}/${row.tokenId}/token.json`,
      );
      expect(row.metadataUri).toBe(row.tokenURI);
      expect(row.externalUrl).toMatch(
        new RegExp(`/editions/${row.contractAddress}-${row.tokenId}$`),
      );
    }
    for (const row of report.records.filter(
      (entry) => entry.identityStatus === 'reported',
    )) {
      expect(row.tokenURI).toBeUndefined();
      expect(
        snapshot.records.find((record) => record.cid === row.cid)
          ?.identityStatus,
      ).toBe('reported');
    }
  });

  it('groups the seven original collection names and limits coverage to complete matching inventories', () => {
    const expected = [
      ['6299ca161f3e98af7d976a6f', 'h0m3w0rk', 12],
      ['63bf30d6874e8e6af40f1c31', 'Danktone 000', 1],
      ['63d6f5db3c0cbf340f528699', 'Danktone 003', 1478],
      ['63ed56a882b726f72c1b3c95', 'Danktone 004', 154],
      ['6421c2008973a69687b3d75b', 'Danktone 005', 66],
      ['64d288613d7854eb2846447b', 'Danktone 006', 68],
      ['64f8d28b6763d160c98ed504', 'Danktone 007', 37],
    ] as const;
    for (const [id, name, count] of expected) {
      const project = getBlueprintProject(id);
      expect(project?.name.toLocaleLowerCase()).toBe(name.toLocaleLowerCase());
      expect(project?.family).toBe('music-blueprints');
      expect(project?.count).toBe(count);
    }
    expect(coverage['63d6f5db3c0cbf340f528699']?.mintedCount).toBe(1478);
    expect(coverage['6421c2008973a69687b3d75b']?.mintedCount).toBe(66);
    expect(coverage['64d288613d7854eb2846447b']?.mintedCount).toBe(68);
    expect(coverage['64f8d28b6763d160c98ed504']?.mintedCount).toBe(37);
    expect(coverage['6299ca161f3e98af7d976a6f']).toBeUndefined();
    expect(coverage['63bf30d6874e8e6af40f1c31']).toBeUndefined();
    expect(coverage['63ed56a882b726f72c1b3c95']).toBeUndefined();
  });
});
