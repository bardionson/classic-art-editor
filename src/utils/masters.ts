import mastersData from '@/masters.json';
import { V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS } from '@/config';
import type { GalleryItem } from '@/components/gallery/Gallery';

interface Master {
  tokenId: string;
  contractAddress: string;
  name: string;
  description: string;
  imageUrl: string;
  layerCount: number;
  metadataUri: string;
  openSeaUrl: string;
}

interface MastersData {
  [contractAddress: string]: Master[];
}

function resolveVersion(contractAddress: string): 'v1' | 'v2' {
  if (
    V1_CONTRACT_ADDRESS &&
    contractAddress.toLowerCase() === V1_CONTRACT_ADDRESS.toLowerCase()
  ) {
    return 'v1';
  }
  return 'v2'; // matches existing fallback behavior exactly
}

// A handful of masters.json entries have a bare IPFS CID as imageUrl instead
// of a full URL. next/image rejects those (crashing the whole page in dev,
// silently broken thumbnails in prod), so normalize them to a gateway URL.
export function normalizeImageUrl(imageUrl: string): string {
  if (!imageUrl || imageUrl.startsWith('http')) return imageUrl;
  return `https://ipfs.io/ipfs/${imageUrl.replace(/^ipfs:\/\//, '')}`;
}

export function getMastersGalleryItems(): GalleryItem[] {
  const data = mastersData as MastersData;
  const items: GalleryItem[] = [];

  Object.keys(data).forEach((contractAddress) => {
    const version = resolveVersion(contractAddress);
    data[contractAddress].forEach((master) => {
      items.push({
        id: `${contractAddress}-${master.tokenId}`,
        tokenId: master.tokenId,
        name: master.name,
        description: master.description,
        imageUrl: normalizeImageUrl(master.imageUrl),
        artistName: '',
        link: `/${version}/${master.tokenId}?referrer=masters`,
        date: parseInt(master.tokenId, 10),
      });
    });
  });

  return items;
}
