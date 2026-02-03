import Gallery, { GalleryItem } from '@/components/gallery/Gallery';
import layersData from '@/layers.json';
import mastersData from '@/masters.json';
import { V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS } from '@/config';

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

const getGalleryItems = (): GalleryItem[] => {
  const lData = layersData as LayersData;
  const mData = mastersData as MastersData;
  const items: GalleryItem[] = [];

  // Create a map of Master CID -> Master TokenID
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

  // Iterate over each contract address in layers data
  Object.keys(lData).forEach((contractAddress) => {
    const layers = lData[contractAddress];

    // Determine version based on contract address
    let version = 'v2'; // Default to v2
    if (V1_CONTRACT_ADDRESS && contractAddress.toLowerCase() === V1_CONTRACT_ADDRESS.toLowerCase()) {
      version = 'v1';
    } else if (V2_CONTRACT_ADDRESS && contractAddress.toLowerCase() === V2_CONTRACT_ADDRESS.toLowerCase()) {
      version = 'v2';
    }

    layers.forEach((layer) => {
      const masterId = cidToMasterTokenId[layer.masterTokenId];

      // If we found a master token ID, link to it.
      const link = masterId ? `/${version}/${masterId}?referrer=layers` : '#';

      items.push({
        id: `${contractAddress}-${layer.tokenId}`,
        tokenId: layer.tokenId,
        name: layer.name,
        description: layer.description || '',
        imageUrl: layer.imageUrl,
        artistName: layer.artistName || '',
        link: link,
        date: parseInt(layer.tokenId, 10), // Using tokenId as a proxy for date/order
      });
    });
  });

  return items;
};

export default function LayersGalleryPage() {
  const items = getGalleryItems();

  return <Gallery title="Async Art Layers Gallery (incomplete)" items={items} />;
}
