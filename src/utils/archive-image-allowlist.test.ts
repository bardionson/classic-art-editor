import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import sources from '@/data/archive-image-sources.json';
import snapshot from '@/data/archive-index.json';
import {
  archiveImageCachePath,
  archiveImageCandidates,
  imageCandidates,
  ipfsPath,
} from './archive-media';
describe('Dynamic Blueprint original image allowlist', () => {
  it('includes exactly the immutable IPFS image paths of dynamic records', () => {
    const dynamic = snapshot.records.filter(
      (r) => r.family === 'dynamic-blueprints',
    );
    const expected = new Set(
      dynamic.flatMap((r) => {
        const p = ipfsPath(r.image ?? '');
        return p ? [p] : [];
      }),
    );
    for (const record of dynamic) {
      if (!record.metadataVerified || !record.metadataLocal) continue;
      const metadata = JSON.parse(
        readFileSync(`public/archive/metadata/${record.cid}.json`, 'utf8'),
      );
      for (const variation of metadata['async-attributes']?.dbpTypes ?? []) {
        for (const layer of variation.layers ?? []) {
          const path = ipfsPath(layer.state?.uri ?? '');
          if (path) expected.add(path);
        }
      }
    }
    expect(new Set(sources)).toEqual(expected);
    expect(new Set(sources).size).toBe(sources.length);
    expect(sources.length).toBeGreaterThan(518);
  });
  it('tries the local cache before original gateways only for allowlisted exact paths', () => {
    const path = sources[0];
    expect(archiveImageCachePath(`ipfs://${path}`)).toBe(path);
    expect(archiveImageCandidates(`ipfs://${path}`)[0]).toBe(
      `/api/archive/image?path=${encodeURIComponent(path)}`,
    );
    expect(archiveImageCachePath(`ipfs://${path}/sibling`)).toBeNull();
    const unrelated = 'https://example.com/original.gif';
    expect(archiveImageCandidates(unrelated)).toEqual(
      imageCandidates(unrelated),
    );
  });
});
