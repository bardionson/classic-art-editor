import { describe, it, expect } from 'vitest';
import {
  getLayersGalleryItems,
  getStaticLayerData,
  getMasterLinkForLayer,
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
