import Gallery, { GalleryItem } from '@/components/gallery/Gallery';
import mastersData from '@/masters.json';
import { V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS } from '@/config';

// Type definition for the masters.json structure
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

// Convert JSON data to GalleryItem format
const getGalleryItems = (): GalleryItem[] => {
  const data = mastersData as MastersData;
  const items: GalleryItem[] = [];

  // Iterate over each contract address in the data
  Object.keys(data).forEach((contractAddress) => {
    const masters = data[contractAddress];

    // Determine version based on contract address
    let version = 'v2'; // Default to v2
    if (V1_CONTRACT_ADDRESS && contractAddress.toLowerCase() === V1_CONTRACT_ADDRESS.toLowerCase()) {
      version = 'v1';
    } else if (V2_CONTRACT_ADDRESS && contractAddress.toLowerCase() === V2_CONTRACT_ADDRESS.toLowerCase()) {
      version = 'v2';
    }

    masters.forEach((master) => {
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
};

export default function MastersGalleryPage() {
  const items = getGalleryItems();

  return <Gallery title="Async Art Restored Masters Gallery" items={items} />;
}
