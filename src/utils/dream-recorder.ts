import data from '@/data/dream-recorder.json';
import type { ArchiveRecord } from './archive-search';

export const dreamRecorder = data;
export type DreamEdition = {
  name: string;
  image: string;
  animation: string;
  musician: string | null;
  artists: string[];
  attributes: { trait_type: string; value: string }[];
  cid: string;
};
export const dreamEditions = data.editions as Record<string, DreamEdition>;
export const dreamProjectHref = `/archive/blueprints/project/${data.projectId}`;
export function dreamEditionHref(token: string) {
  return `${dreamProjectHref}/editions/${token}`;
}
export function dreamMetadataUri(token: string) {
  return `ipfs://${data.metadataRoot}/${token}/token.json`;
}
export function dreamMediaUri(value: string) {
  return value.startsWith('Qm') ? `ipfs://${value}` : value;
}
export const dreamRecorderRecords: ArchiveRecord[] = Object.entries(
  dreamEditions,
).map(([token, e]) => ({
  id: `${data.contractAddress}:${token}`,
  name: e.name,
  artist: data.artist,
  description: [
    e.musician || 'Legendary Edition',
    ...e.artists,
    ...e.attributes.map((a) => `${a.trait_type}: ${a.value}`),
  ].join(' · '),
  family: 'music-blueprints',
  kind: e.musician ? 'Edition' : 'Legendary Edition',
  tokenId: token,
  contractAddress: data.contractAddress,
  cid: e.cid,
  link: dreamEditionHref(token),
  source: 'The Guild Archive edition data and Ethereum tokenURI audit',
  identityStatus: 'verified',
  metadataVerified: !!e.cid,
  metadataLocal: !!e.cid,
  blueprintId: data.projectId,
  collection: data.name,
  image: dreamMediaUri(e.image),
  animationUrl: dreamMediaUri(e.animation),
  metadataUri: dreamMetadataUri(token),
}));
