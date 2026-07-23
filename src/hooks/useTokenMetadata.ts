import { useState, useEffect, useRef } from 'react';
import { Address, getContract } from 'viem';
import v1Abi from '@/abis/v1Abi';
import v2Abi from '@/abis/v2Abi';
import { V1_CONTRACT_ADDRESS } from '@/config';
import { MasterArtNFTMetadata } from '@/types/shared';
import { fetchIpfs } from '@/utils/ipfs';
import { getMasterArtSize } from '@/components/master-art-viewer/utils';

export const useTokenMetadata = (tokenAddress: Address, tokenId: number) => {
  const isComponentMountedRef = useRef(true);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Loading NFT metadata...',
  );
  const [metadata, setMetadata] = useState<MasterArtNFTMetadata>();
  const [collector, setCollector] = useState<Address>();
  const [error, setError] = useState<string>();
  const [isLandscape, setIsLandscape] = useState(false);
  const [fetchedTokenURI, setFetchedTokenURI] = useState<string>();
  const [masterArtSize, setMasterArtSize] = useState<{
    width: number;
    height: number;
    resizeToFitScreenRatio: number;
  }>();
  const [artists, setArtists] = useState<string[]>([]);

  useEffect(() => {
    isComponentMountedRef.current = true;
    const fetchMetadata = async () => {
      setStatusMessage('Loading NFT metadata...');
      setError(undefined);
      try {
        const { publicClient } = await import('@/utils/rpcClient');

        const contract = getContract({
          address: tokenAddress,
          abi: tokenAddress === V1_CONTRACT_ADDRESS ? v1Abi : v2Abi,
          client: publicClient,
        });

        let tokenURI;
        try {
          tokenURI = await contract.read.tokenURI([BigInt(tokenId)]);
          if (!isComponentMountedRef.current) return;
          setFetchedTokenURI(tokenURI);
          if (!tokenURI) throw new Error('URI query for nonexistent token');

          const owner = await contract.read.ownerOf([BigInt(tokenId)]);
          if (!isComponentMountedRef.current) return;
          setCollector(owner);
        } catch (e: any) {
          console.error('Contract read error:', e);
          const errorMessage = e?.message?.toLowerCase() || '';

          if (
            errorMessage.includes('query for nonexistent token') ||
            errorMessage.includes('execution reverted') ||
            errorMessage.includes('invalid token id')
          ) {
            throw new Error(
              'Token not found. Please check the version and ID.',
            );
          } else {
            // Re-throw other errors (network, etc) so the outer catch can handle them,
            // or provide a more specific network error message
            throw new Error(
              `Failed to load token data: ${e.message || 'Unknown error'}`,
            );
          }
        }

        const response = await fetchIpfs(tokenURI);
        const metadata = (await response.json()) as MasterArtNFTMetadata;
        if (!isComponentMountedRef.current) return;
        setMetadata(metadata);

        // Extract artists from attributes
        if (metadata.attributes) {
          const extractedArtists = metadata.attributes
            .filter(
              (attr: any) =>
                attr.trait_type === 'Artist' || attr.trait_type === 'Creator',
            )
            .map((attr: any) => attr.value);
          setArtists(extractedArtists);
        }

        const size = await getMasterArtSize(metadata.image);
        if (!isComponentMountedRef.current) return;
        setMasterArtSize(size);
        setIsLandscape(size.width > size.height);
        setStatusMessage('');
      } catch (e: any) {
        console.error(e);
        if (isComponentMountedRef.current) {
          setError(e.message);
          setStatusMessage('');
        }
      }
    };

    if (tokenAddress && !isNaN(tokenId)) {
      fetchMetadata();
    }

    return () => {
      isComponentMountedRef.current = false;
    };
  }, [tokenAddress, tokenId]);

  return {
    statusMessage,
    metadata,
    collector,
    error,
    isLandscape,
    tokenURI: fetchedTokenURI,
    masterArtSize,
    artists,
  };
};
