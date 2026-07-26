import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { getMastersGalleryItems } from '@/utils/masters';
import { getLayersGalleryItems } from '@/utils/layers';
import type { GalleryItem } from '@/components/gallery/Gallery';

interface OwnedNftItem {
  contractAddress: string;
  tokenId: string;
}

export function useOwnedAsyncNfts() {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [ownedMasters, setOwnedMasters] = useState<GalleryItem[]>([]);
  const [ownedLayers, setOwnedLayers] = useState<GalleryItem[]>([]);

  useEffect(() => {
    if (!isConnected || !address) {
      setOwnedMasters([]);
      setOwnedLayers([]);
      return;
    }

    let isMounted = true;

    const fetchOwnedNfts = async () => {
      setIsLoading(true);
      setError(undefined);
      try {
        const response = await fetch(`/api/owned-nfts?address=${address}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load owned NFTs');
        }

        if (!isMounted) return;

        const items = (data.items || []) as OwnedNftItem[];
        const ownedKeys = new Set(
          items.map((item) => `${item.contractAddress}-${item.tokenId}`),
        );

        const masters = getMastersGalleryItems().filter(
          (item) =>
            item.contractAddress &&
            ownedKeys.has(`${item.contractAddress}-${item.tokenId}`),
        );
        const layers = getLayersGalleryItems().filter(
          (item) =>
            item.contractAddress &&
            ownedKeys.has(`${item.contractAddress}-${item.tokenId}`),
        );

        setOwnedMasters(masters);
        setOwnedLayers(layers);
      } catch (e: any) {
        if (isMounted) {
          setError(e.message || 'Failed to load owned NFTs');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchOwnedNfts();

    return () => {
      isMounted = false;
    };
  }, [address, isConnected]);

  return { isConnected, isLoading, error, ownedMasters, ownedLayers };
}
