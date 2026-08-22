import { describe, it, expect } from 'vitest';
import {
  getLayersGalleryItems,
  getStaticLayerData,
  getMasterLinkForLayer,
  getMasterArtistNames,
} from './layers';
import layersData from '@/layers.json';
import mastersData from '@/masters.json';

const CONTRACT_ADDRESS = Object.keys(layersData)[0];
const FIRST_LAYER = (layersData as any)[CONTRACT_ADDRESS][0];

describe('getLayersGalleryItems', () => {
  it('marks every item as isLayer: true', () => {
    const items = getLayersGalleryItems();
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.isLayer === true)).toBe(true);
  });
});

describe('getStaticLayerData', () => {
  it('returns the raw layer entry for a known contract + tokenId', () => {
    const result = getStaticLayerData(CONTRACT_ADDRESS, FIRST_LAYER.tokenId);
    expect(result).not.toBeNull();
    expect(result?.tokenId).toBe(FIRST_LAYER.tokenId);
    expect(result?.name).toBe(FIRST_LAYER.name);
  });

  it('matches contract address case-insensitively', () => {
    const result = getStaticLayerData(
      CONTRACT_ADDRESS.toUpperCase(),
      FIRST_LAYER.tokenId,
    );
    expect(result).not.toBeNull();
    expect(result?.tokenId).toBe(FIRST_LAYER.tokenId);
  });

  it('returns null for an unknown contract address', () => {
    expect(
      getStaticLayerData('0xdoesnotexist', FIRST_LAYER.tokenId),
    ).toBeNull();
  });

  it('returns null for an unknown tokenId on a known contract', () => {
    expect(getStaticLayerData(CONTRACT_ADDRESS, '__nope__')).toBeNull();
  });
});

describe('getMasterLinkForLayer', () => {
  it('resolves a link for a CID that matches a known master', () => {
    const mData = mastersData as Record<
      string,
      { tokenId: string; metadataUri: string }[]
    >;
    const [contractAddress, masters] = Object.entries(mData)[0];
    const master = masters[0];
    const parts = master.metadataUri.split('/');
    const cid = parts[parts.length - 1];

    const link = getMasterLinkForLayer(cid);
    expect(link).not.toBeNull();
    expect(link).toContain(master.tokenId);
  });

  it('returns null for a CID that matches no master', () => {
    expect(getMasterLinkForLayer('not-a-real-cid')).toBeNull();
  });
});

describe('getMasterArtistNames', () => {
  it('attributes a master to the artists of its layers', () => {
    // Master 538 ("Mind Puzzle") has 8 layers authored by SHORTCUT in
    // layers.json but its own name/description never mentions the artist,
    // so this is only discoverable via the layer data.
    const result = getMasterArtistNames();
    expect(result['538']).toContain('SHORTCUT');
  });

  it('does not attribute a master to an artist who has no layers on it', () => {
    // Master 5475 ("Mariupol") mentions "Shortcut" in its prose credits but
    // has no corresponding layer.json entries, so it must not be attributed.
    const result = getMasterArtistNames();
    expect(result['5475']).toBeUndefined();
  });
});
