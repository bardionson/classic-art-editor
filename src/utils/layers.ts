import layersData from '@/layers.json';
import mastersData from '@/masters.json';
import type { GalleryItem } from '@/components/gallery/Gallery';
import { normalizeImageUrl, resolveVersion } from '@/utils/masters';

// Type definitions
interface Layer {
  tokenId: string;
  contractAddress: string;
  name: string;
  description: string | null;
  imageUrl: string;
  artistName?: string;
  masterTokenId: string; // This is actually a CID in the JSON
  controls: any[];
}

interface Master {
  tokenId: string;
  contractAddress: string;
  metadataUri: string;
}

interface LayersData {
  [contractAddress: string]: Layer[];
}

interface MastersData {
  [contractAddress: string]: Master[];
}

// Master CID -> Master TokenID map, built once from masters.json. Shared by
// getLayersGalleryItems() and getMasterLinkForLayer() so the CID-matching
// logic (which extracts the trailing path segment of metadataUri as the CID)
// lives in exactly one place.
function buildCidToMasterTokenId(): { [cid: string]: string } {
  const mData = mastersData as MastersData;
  const cidToMasterTokenId: { [cid: string]: string } = {};

  Object.values(mData).forEach((masters) => {
    masters.forEach((master) => {
      // Extract CID from metadataUri
      // Format usually: https://.../ipfs/CID or just CID
      const parts = master.metadataUri.split('/');
      const cid = parts[parts.length - 1];
      if (cid) {
        cidToMasterTokenId[cid] = master.tokenId;
      }
    });
  });

  return cidToMasterTokenId;
}

export function getLayersGalleryItems(): GalleryItem[] {
  const lData = layersData as LayersData;
  const items: GalleryItem[] = [];
  const cidToMasterTokenId = buildCidToMasterTokenId();

  // Iterate over each contract address in layers data
  Object.keys(lData).forEach((contractAddress) => {
    const layers = lData[contractAddress];
    const version = resolveVersion(contractAddress);

    layers.forEach((layer) => {
      const masterId = cidToMasterTokenId[layer.masterTokenId];

      // If we found a master token ID, link to it.
      const link = masterId ? `/${version}/${masterId}?referrer=layers` : '#';

      items.push({
        id: `${contractAddress}-${layer.tokenId}`,
        tokenId: layer.tokenId,
        name: layer.name,
        description: layer.description || '',
        imageUrl: normalizeImageUrl(layer.imageUrl),
        artistName: layer.artistName || '',
        link: link,
        date: parseInt(layer.tokenId, 10), // Using tokenId as a proxy for date/order
        contractAddress: contractAddress.toLowerCase(),
        isLayer: true,
      });
    });
  });

  return items;
}

export interface StaticLayerData {
  tokenId: string;
  contractAddress: string;
  name: string;
  description: string | null;
  imageUrl: string;
  artistName?: string;
  masterTokenId: string; // CID
  controls: any[];
}

// Looks up a single raw layer entry directly from layers.json by contract
// address + tokenId. Matches contract address case-insensitively since
// callers may have it in either case (e.g. GalleryItem.contractAddress is
// always lowercased).
export function getStaticLayerData(
  contractAddress: string,
  tokenId: string,
): StaticLayerData | null {
  const lData = layersData as LayersData;
  const matchedKey = Object.keys(lData).find(
    (key) => key.toLowerCase() === contractAddress.toLowerCase(),
  );
  if (!matchedKey) return null;

  const layer = lData[matchedKey].find((l) => l.tokenId === tokenId);
  if (!layer) return null;

  return {
    tokenId: layer.tokenId,
    contractAddress: matchedKey,
    name: layer.name,
    description: layer.description,
    imageUrl: normalizeImageUrl(layer.imageUrl),
    artistName: layer.artistName,
    masterTokenId: layer.masterTokenId,
    controls: layer.controls,
  };
}

// Resolves a layer's master link from the master-CID it references
// (layer.masterTokenId in layers.json is actually a CID, not a token id -
// see the Layer interface above). Reuses the same cidToMasterTokenId map
// getLayersGalleryItems() builds, so the two never drift apart.
export function getMasterLinkForLayer(masterTokenIdCid: string): string | null {
  const cidToMasterTokenId = buildCidToMasterTokenId();
  const masterId = cidToMasterTokenId[masterTokenIdCid];
  if (!masterId) return null;

  const mData = mastersData as MastersData;
  for (const contractAddress of Object.keys(mData)) {
    const match = mData[contractAddress].find((m) => m.tokenId === masterId);
    if (match) {
      const version = resolveVersion(contractAddress);
      return `/${version}/${masterId}?referrer=layers`;
    }
  }

  return null;
}
