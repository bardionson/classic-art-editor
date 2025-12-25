import { useState, useEffect, useRef } from 'react';
import { Address, createPublicClient, getContract, http } from 'viem';
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

  useEffect(() => {
    isComponentMountedRef.current = true;

    const renderArtwork = async () => {
      try {
        const publicClient = createPublicClient({
          chain: __PROD__ ? mainnet : goerli,
          transport: http(),
        });

        const contract = getContract({
          address: tokenAddress,
          abi: tokenAddress === V1_CONTRACT_ADDRESS ? v1Abi : v2Abi,
          client: publicClient,
        });

        let tokenURI;
        try {
          tokenURI = await contract.read.tokenURI([BigInt(tokenId)]);
          setFetchedTokenURI(tokenURI);
          if (!tokenURI) throw new Error('URI query for nonexistent token');
          const owner = await contract.read.ownerOf([BigInt(tokenId)]);
          setCollector(owner);
        } catch (e) {
          throw new Error('Token not found. Please check the version and ID.');
        }

        const response = await fetchIpfs(tokenURI);
        const metadata = (await response.json()) as MasterArtNFTMetadata;
        setMetadata(metadata);

        const masterArtSize = await getMasterArtSize(metadata.image);
        setIsLandscape(masterArtSize.width > masterArtSize.height);

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

        const artElement = artElementRef.current!;
        const { width, height, resizeToFitScreenRatio } = masterArtSize;
        const marginTop =
          (window.innerHeight - height * resizeToFitScreenRatio) / 2;

        artElement.style.marginTop = marginTop > 0 ? `${marginTop}px` : `0px`;
        artElement.style.width = `${width * resizeToFitScreenRatio}px`;
        artElement.style.height = `${height * resizeToFitScreenRatio}px`;

        artElement.innerHTML = '';

        const newLayerHashes: Record<string, string> = {};
        for (const layer of layers) {
          if (!isComponentMountedRef.current) return;

          const layerImageBuilder = new LayerImageBuilder(
            layer.id,
            layer.transformationProperties,
            getLayerControlTokenValue,
          );

          layerImageBuilder.setLayoutVersion(metadata.layout.version || 1);
          if (layer.anchor) {
            const anchorImageEl = Array.from(artElement.children).find(
              (el) => el.id === layer.anchor,
            ) as LayerImageElement;
            layerImageBuilder.setAnchorLayer(anchorImageEl);
          }

          await layerImageBuilder.loadImage(layer.activeStateURI, (domain) =>
            setStatusMessage(
              <>
                Loading layers {artElement.children.length + 1}/{layers.length}
                ...
                <br />
                Loading {layer.activeStateURI} from{' '}
                <a target="_blank" href={`https://${domain}`}>
                  {domain}
                </a>
              </>,
            ),
          );

          const layerImageElement = await layerImageBuilder.build();
          layerImageElement.resize(resizeToFitScreenRatio);
          artElement.appendChild(layerImageElement);
          newLayerHashes[layer.id] = layer.activeStateURI;
        }
        setLayerHashes(newLayerHashes);

        artElement.classList.remove('-z-20');
        setStatusMessage('');
      } catch (e: any) {
        console.error(e);
        setError(e.message);
        setStatusMessage('');
      }
    };

    if (tokenAddress && !isNaN(tokenId)) {
        renderArtwork();
    }

    return () => {
      isComponentMountedRef.current = false;
    };
  }, [tokenAddress, tokenId, controlOverrides]);

  return {
    artElementRef,
    statusMessage,
    metadata,
    collector,
    error,
    layerHashes,
    isLandscape,
    tokenURI: fetchedTokenURI,
  };
};
