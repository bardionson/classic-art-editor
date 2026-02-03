import { useState, useEffect, useRef } from 'react';
import { Address, createPublicClient, getContract, http, isAddressEqual } from 'viem';
import { mainnet, goerli } from 'wagmi/chains';
import v1Abi from '@/abis/v1Abi';
import v2Abi from '@/abis/v2Abi';
import { V1_CONTRACT_ADDRESS, __PROD__ } from '@/config';
import { MasterArtNFTMetadata } from '@/types/shared';
import { fetchIpfs } from '@/utils/ipfs';
import {
  createGetLayerControlTokenValueFn,
  getLayersFromMetadata,
  getMasterArtSize,
} from '@/components/master-art-viewer/utils';
import LayerImageBuilder, {
  LayerImageElement,
} from '@/components/master-art-viewer/layer-image-builder';

export const useArtwork = (
  tokenAddress: Address,
  tokenId: number,
  controlOverrides: Record<string, number> = {},
) => {
  const isComponentMountedRef = useRef(true);
  const artElementRef = useRef<HTMLDivElement>(null);
  const [statusMessage, setStatusMessage] = useState<
    string | React.JSX.Element
  >('Loading NFT metadata...');
  const [metadata, setMetadata] = useState<MasterArtNFTMetadata>();
  const [collector, setCollector] = useState<Address>();
  const [error, setError] = useState<string>();
  const [layerHashes, setLayerHashes] = useState<Record<string, string>>({});
  const [isLandscape, setIsLandscape] = useState(false);
  const [fetchedTokenURI, setFetchedTokenURI] = useState<string>();
  const [masterArtSize, setMasterArtSize] = useState<{
    width: number;
    height: number;
    resizeToFitScreenRatio: number;
  }>();
  const [artists, setArtists] = useState<string[]>([]);

  const layerBlobUrlsRef = useRef<Record<string, string>>({});

  // 1. Fetch Metadata (only re-runs if token changes)
  useEffect(() => {
    isComponentMountedRef.current = true;
    const fetchMetadata = async () => {
      setStatusMessage('Loading NFT metadata...');
      setError(undefined);
      try {
        const publicClient = createPublicClient({
          chain: __PROD__ ? mainnet : goerli,
          transport: http(),
        });

        const isV1 =
          V1_CONTRACT_ADDRESS &&
          isAddressEqual(tokenAddress, V1_CONTRACT_ADDRESS as Address);

        const contract = getContract({
          address: tokenAddress,
          abi: isV1 ? v1Abi : v2Abi,
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
        } catch (e) {
          throw new Error('Token not found. Please check the version and ID.');
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

  // 2. Render Layers (re-runs if metadata or overrides change)
  useEffect(() => {
    const renderLayers = async () => {
      if (!metadata || !masterArtSize || !artElementRef.current) return;
      // If we have an error from metadata fetch, don't try to render
      if (error) return;

      try {
        const getLayerControlTokenValue = createGetLayerControlTokenValueFn(
          tokenId,
          metadata['async-attributes']?.['unminted-token-values'],
          controlOverrides,
        );

        if (!isComponentMountedRef.current) return;

        const layers = await getLayersFromMetadata(
          metadata.layout.layers,
          getLayerControlTokenValue,
        );

        const artElement = artElementRef.current;
        const { width, height, resizeToFitScreenRatio } = masterArtSize;
        const marginTop =
          (window.innerHeight - height * resizeToFitScreenRatio) / 2;

        artElement.style.marginTop = marginTop > 0 ? `${marginTop}px` : `0px`;
        artElement.style.width = `${width * resizeToFitScreenRatio}px`;
        artElement.style.height = `${height * resizeToFitScreenRatio}px`;

        artElement.innerHTML = '';

        const newLayerHashes: Record<string, string> = {};

        // Initiate parallel loading
        const layerBuilders = layers.map((layer) => {
          const builder = new LayerImageBuilder(
            layer.id,
            layer.transformationProperties,
            getLayerControlTokenValue,
          );
          builder.setLayoutVersion(metadata.layout.version || 1);

          const loadTask = async () => {
            const cachedUrl = layerBlobUrlsRef.current[layer.activeStateURI];

            const blobUrl = await builder.loadImage(
              layer.activeStateURI,
              (domain) =>
                setStatusMessage(
                  <>
                    Loading layers...
                    <br />
                    Loading {layer.activeStateURI} from{' '}
                    <a target="_blank" href={`https://${domain}`}>
                      {domain}
                    </a>
                  </>,
                ),
              cachedUrl,
            );

            if (blobUrl) {
                layerBlobUrlsRef.current[layer.activeStateURI] = blobUrl;
            }
          };

          return {
            layer,
            builder,
            loadPromise: loadTask(),
          };
        });

        // Build and append in strict order
        for (const { layer, builder, loadPromise } of layerBuilders) {
          try {
            if (!isComponentMountedRef.current) return;

            // Wait for this specific layer's image to load
            await loadPromise;

            if (layer.anchor) {
              const anchorImageEl = Array.from(artElement.children).find(
                (el) => el.id === layer.anchor,
              ) as LayerImageElement;
              // If anchor failed to load, it won't be in DOM, so anchorImageEl will be undefined.
              // setAnchorLayer handles undefined by setting anchorLayer to null.
              builder.setAnchorLayer(anchorImageEl);
            }

            const layerImageElement = await builder.build();
            layerImageElement.resize(resizeToFitScreenRatio);
            artElement.appendChild(layerImageElement);
            newLayerHashes[layer.id] = layer.activeStateURI;
          } catch (e: any) {
            console.error(`Failed to load layer ${layer.id}:`, e);
          }
        }

        if (!isComponentMountedRef.current) return;
        setLayerHashes(newLayerHashes);

        artElement.classList.remove('-z-20');
        setStatusMessage('');
      } catch (e: any) {
        console.error(e);
        if (isComponentMountedRef.current) {
          setError(e.message);
          setStatusMessage('');
        }
      }
    };

    renderLayers();
  }, [metadata, masterArtSize, controlOverrides, tokenId, error]);

  return {
    artElementRef,
    statusMessage,
    metadata,
    collector,
    error,
    layerHashes,
    isLandscape,
    tokenURI: fetchedTokenURI,
    artists,
    masterArtSize,
  };
};
