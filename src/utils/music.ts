import { MasterArtNFTMetadata } from '@/types/shared';

export const AUDIO_GATEWAYS = [
  { name: 'Alchemy IPFS', url: 'https://alchemy.mypinata.cloud' },
  { name: 'Pinata', url: 'https://gateway.pinata.cloud' },
  { name: 'IPFS.io', url: 'https://ipfs.io' },
];

/** Keep the archived CID unchanged when selecting a delivery gateway. */
export function audioUrl(uri: string, gateway: string): string {
  const path = uri
    .trim()
    .replace(/^ipfs:\/\/(?:ipfs\/)?/, '')
    .replace(/^https?:\/\/[^/]+\/ipfs\//, '');
  if (
    !/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]+)(\/[^?#]*)?$/.test(path) ||
    path.split('/').some((part) => part === '..' || part === '.')
  ) {
    throw new Error('This stem has an unsupported IPFS address.');
  }
  return `${gateway}/ipfs/${path}`;
}

export type MusicStem = {
  id: string;
  relativeTokenId: number;
  leverId: number;
  stateIndex: number;
  uri: string;
  options: { uri: string }[];
};

export async function resolveMusicStems(
  metadata: MasterArtNFTMetadata,
  getValue: (relativeId: number, leverId: number) => Promise<number>,
): Promise<MusicStem[]> {
  const layout = metadata['audio-layout'];
  if (
    !layout ||
    layout.type !== 'layered_static' ||
    layout.version !== 1 ||
    !Array.isArray(layout.layers) ||
    !layout.layers.length
  ) {
    throw new Error('This audio layout needs a different restoration player.');
  }
  return Promise.all(
    layout.layers.map(async (layer) => {
      const states = layer.states;
      if (
        !states ||
        !Number.isInteger(states['token-id']) ||
        !Number.isInteger(states['lever-id']) ||
        states['token-id'] < 0 ||
        states['lever-id'] < 0 ||
        !Array.isArray(states.options)
      ) {
        throw new Error(`Missing audio controls for ${layer.id}.`);
      }
      const stateIndex = await getValue(states['token-id'], states['lever-id']);
      if (
        !Number.isInteger(stateIndex) ||
        stateIndex < 0 ||
        !states.options[stateIndex]?.uri
      ) {
        throw new Error(`Missing audio variant for ${layer.id}.`);
      }
      // Validate every selectable variant before exposing controls.
      states.options.forEach((option) =>
        audioUrl(option.uri, AUDIO_GATEWAYS[0].url),
      );
      return {
        id: layer.id,
        relativeTokenId: states['token-id'],
        leverId: states['lever-id'],
        stateIndex,
        uri: states.options[stateIndex].uri,
        options: states.options,
      };
    }),
  );
}
