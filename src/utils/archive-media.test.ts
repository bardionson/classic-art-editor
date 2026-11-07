import { describe, expect, it } from 'vitest';
import { imageCandidates, ipfsPath, metadataImage } from './archive-media';

const cid = 'QmYfy2qQBceBghoQGTsLUXpqZibbmoN11eTaDMPAkAAkUe';
describe('original archive previews', () => {
  it('extracts image fields, never treating metadata documents or animation pages as images', () => {
    expect(metadataImage({ image: `ipfs://${cid}` })).toBe(`ipfs://${cid}`);
    expect(
      metadataImage({ image_url: `https://ipfs.io/ipfs/${cid}` }),
    ).toContain(cid);
    expect(
      metadataImage({ animation_url: 'https://example.com/player.html' }),
    ).toBeNull();
    expect(
      metadataImage({ image_data: '<svg onload="alert(1)" />' }),
    ).toBeNull();
  });
  it('preserves CID casing and paths across gateway fallbacks', () => {
    expect(ipfsPath(`ipfs://ipfs/${cid}/cover.png`)).toBe(`${cid}/cover.png`);
    expect(
      imageCandidates(`https://ipfs.io/ipfs/${cid}/cover.png`),
    ).toHaveLength(3);
    expect(imageCandidates(cid).every((url) => url.endsWith(cid))).toBe(true);
  });
  it('rejects executable, local and malformed media references', () => {
    for (const value of [
      'javascript:alert(1)',
      'data:image/svg+xml,<svg/>',
      'http://example.com/x',
      'https://localhost/x',
      'https://127.0.0.1/x',
      'https://user:pass@example.com/x',
      `ipfs://${cid}/../x`,
      `ipfs://${cid}/%2e%2e/x`,
    ]) {
      expect(imageCandidates(value)).toEqual([]);
    }
  });
});
