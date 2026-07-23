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
        imageUrl: master.imageUrl,
        artistName: '',
        link: `/${version}/${master.tokenId}?referrer=masters`,
        date: parseInt(master.tokenId, 10),
      });
    });
  });

  return items;
}
