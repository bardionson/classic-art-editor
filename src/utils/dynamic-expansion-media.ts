import recovered from '@/data/dynamic-expansion-media.json';

export type ExpansionMedia = {
  layers: { source: string; label: string; slot: string; type: string }[];
  metadataSha256: string;
};

export function getExpansionMedia(cid: string): ExpansionMedia | null {
  return Object.prototype.hasOwnProperty.call(recovered, cid)
    ? (recovered as Record<string, ExpansionMedia>)[cid]
    : null;
}
