import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import recovered from '@/data/dynamic-expansion-media.json';
import { getExpansionMedia } from './dynamic-expansion-media';
import { ipfsPath, archiveImageCachePath } from './archive-media';

describe('original Dynamic Blueprint expansion media', () => {
  it('uses each item’s declared state image, independently of shared pack covers', () => {
    const apple = getExpansionMedia(
      'QmQWxDKg1BnMKsVJzaaDbKBSRGCMS2Ur2UgNTzJTMunF2M',
    );
    expect(apple?.layers[0].source).toBe(
      'ipfs://Qmcrw2fWRkpYvsBaVpdtdD6LW217KgQhsxLygKYXqPjH1j',
    );
    expect(getExpansionMedia('__proto__')).toBeNull();
    expect(getExpansionMedia('unknown')).toBeNull();
  });
  it('retains exact metadata provenance and all declared layers for every recovered item', () => {
    expect(Object.keys(recovered)).toHaveLength(1418);
    for (const [cid, media] of Object.entries(recovered)) {
      const bytes = readFileSync(`public/archive/metadata/${cid}.json`);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        media.metadataSha256,
      );
      const original = JSON.parse(bytes.toString());
      const sources = original['async-attributes'].dbpTypes.flatMap(
        (type: { layers: { state: { uri: string } }[] }) =>
          type.layers.map(
            (layer) => 'ipfs://' + layer.state.uri.replace(/^ipfs:\/\//, ''),
          ),
      );
      expect(media.layers.map((layer) => layer.source)).toEqual(sources);
      for (const layer of media.layers) {
        expect(ipfsPath(layer.source)).toBeTruthy();
        expect(archiveImageCachePath(layer.source)).toBe(
          ipfsPath(layer.source),
        );
      }
    }
  });
});
