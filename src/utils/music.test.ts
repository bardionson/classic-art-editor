import { describe, expect, it } from 'vitest';
import { audioUrl, resolveMusicStems } from './music';
import { MasterArtNFTMetadata } from '@/types/shared';

const cid = 'QmXakadf7rbqtyMjjkmcUNFPsrRyfTdd2nbm9XwWhZdCna';
const second = 'QmTajp1MsaKydEYtp3S5AzbmCiEQy3uruagDguFiYLEuFZ';
const metadata = {
  'audio-layout': {
    type: 'layered_static',
    version: 1,
    layers: [
      {
        id: '01_Piano',
        states: {
          'token-id': 1,
          'lever-id': 0,
          options: [{ uri: cid }, { uri: second }],
        },
      },
    ],
  },
} as MasterArtNFTMetadata;

describe('archived music metadata', () => {
  it('retains the original CID across delivery gateways and URI forms', () => {
    for (const uri of [
      cid,
      `ipfs://${cid}`,
      `https://old.example/ipfs/${cid}`,
    ]) {
      expect(audioUrl(uri, 'https://ipfs.io')).toBe(
        `https://ipfs.io/ipfs/${cid}`,
      );
    }
  });
  it('rejects non-IPFS sources and path traversal', () => {
    for (const uri of [
      'javascript:alert(1)',
      'https://unknown.example/audio.mp3',
      `${cid}/../bad`,
    ]) {
      expect(() => audioUrl(uri, 'https://ipfs.io')).toThrow();
    }
  });
  it('selects the recorded variant using relative token and lever IDs', async () => {
    const stems = await resolveMusicStems(metadata, async (relative, lever) => {
      expect([relative, lever]).toEqual([1, 0]);
      return 1;
    });
    expect(stems[0].uri).toBe(second);
    expect(stems[0].stateIndex).toBe(1);
  });
  it('does not silently substitute variant zero when controls fail', async () => {
    await expect(
      resolveMusicStems(metadata, async () => {
        throw new Error('RPC unavailable');
      }),
    ).rejects.toThrow('RPC unavailable');
    for (const invalid of [-1, 2, NaN, 0.5]) {
      await expect(
        resolveMusicStems(metadata, async () => invalid),
      ).rejects.toThrow('Missing audio variant');
    }
  });
  it('rejects unsupported audio layout versions', async () => {
    await expect(
      resolveMusicStems(
        {
          ...metadata,
          'audio-layout': { ...metadata['audio-layout']!, version: 2 },
        },
        async () => 0,
      ),
    ).rejects.toThrow('different restoration player');
  });
});
