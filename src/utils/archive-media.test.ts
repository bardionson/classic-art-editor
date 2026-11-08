import { describe, expect, it } from 'vitest';
import {
  imageCandidates,
  ipfsPath,
  metadataImage,
  isArchiveVideo,
} from './archive-media';

const cid = 'QmYfy2qQBceBghoQGTsLUXpqZibbmoN11eTaDMPAkAAkUe';
describe('original archive previews', () => {
  it('recognizes confirmed video even when stored in the image field', () => {
    const video = 'QmbherGdPvB6Q3zQfmhnKwm5ECwzLiuyV6A8PzbZeVwKRx';
    expect(isArchiveVideo(`ipfs://${video}`)).toBe(true);
    expect(isArchiveVideo(`https://ipfs.io/ipfs/${video}`)).toBe(true);
    expect(isArchiveVideo(`ipfs://${video}/different.png`)).toBe(false);
    expect(isArchiveVideo(`ipfs://${cid}`)).toBe(false);
    expect(isArchiveVideo('javascript:alert(1)')).toBe(false);
  });
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
    expect(imageCandidates(`https://ipfs.io/ipfs/${cid}/cover.png`)).toEqual([
      `https://ipfs.filebase.io/ipfs/${cid}/cover.png`,
      `https://alchemy.mypinata.cloud/ipfs/${cid}/cover.png`,
      `https://gateway.pinata.cloud/ipfs/${cid}/cover.png`,
      `https://ipfs.io/ipfs/${cid}/cover.png`,
    ]);
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
