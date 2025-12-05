'use client';

import v1Abi from '@/abis/v1Abi';
import v2Abi from '@/abis/v2Abi';
import Spinner from '@/components/common/spinner';
import LayerImageBuilder, {
  LayerImageElement,
} from '@/components/master-art-viewer/layer-image-builder';
import {
  createGetLayerControlTokenValueFn,
  getLayersFromMetadata,
  getMasterArtSize,
} from '@/components/master-art-viewer/utils';
import { V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS, __PROD__ } from '@/config';
import { MasterArtNFTMetadata } from '@/types/shared';
import { fetchIpfs } from '@/utils/ipfs';
import { useEffect, useRef, useState } from 'react';
import { XCircle, X, Maximize } from 'react-feather';
import { Address, createPublicClient, getContract, http } from 'viem';
import { mainnet, goerli } from 'wagmi/chains';

const ART_ELEMENT_ID = 'master-art';
const ERROR_MESSAGE = 'Unexpected issue occured.\nPlease try again.';

type ArtworkViewerProps = {
  tokenAddress: Address;
  tokenId: number;
  initialFullscreen?: boolean;
};

export default function ArtworkViewer({
  tokenAddress,
  tokenId,
  initialFullscreen,
}: ArtworkViewerProps) {
  const isComponentMountedRef = useRef(true);
  const artElementRef = useRef<HTMLDivElement>(null);
  const [statusMessage, setStatusMessage] = useState<
    string | React.JSX.Element
  >('Loading NFT metadata...');
  const [metadata, setMetadata] = useState<MasterArtNFTMetadata>();
  const [collector, setCollector] = useState<Address>();
  const [error, setError] = useState<string>();
  const [isFullscreen, setIsFullscreen] = useState(!!initialFullscreen);

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
        // V1 contract won't fail for non existent token, it will just return an empty string.
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

      const getLayerControlTokenValue = createGetLayerControlTokenValueFn(
        tokenId,
        metadata['async-attributes']?.['unminted-token-values'],
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
      }

      artElement.classList.remove('-z-20');
      setStatusMessage('');
    } catch (e: any) {
      console.error(e);
      setError(e.message);
      setStatusMessage('');
    }
  };

  useEffect(() => {
    renderArtwork();

    return () => {
      isComponentMountedRef.current = false;
    };
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <XCircle size={80} className="text-red mx-auto mb-8" />
          <p className="text-red text-center">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen">
      <div className="flex-grow flex items-center justify-center relative">
        {statusMessage && (
          <div className="w-full fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4">
            {statusMessage === ERROR_MESSAGE ? (
              <>
                <XCircle size={80} className="text-red mx-auto mb-8" />
                <p className="text-white text-center">
                  {ERROR_MESSAGE.split('\n')[0]}
                  <br />
                  {ERROR_MESSAGE.split('\n')[1]}
                </p>
              </>
            ) : (
              <>
                <Spinner size={80} className="text-purple mx-auto mt-12 mb-8" />
                <p className="text-white text-center break-all">
                  {statusMessage}
                  <br />
                  The process can take several minutes.
                </p>
              </>
            )}
          </div>
        )}
        <div
          id={ART_ELEMENT_ID}
          ref={artElementRef}
          className="relative mx-auto -z-20"
        />
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="absolute bottom-4 right-4 bg-gray-800 text-white p-2 rounded-full"
        >
          {isFullscreen ? <X /> : <Maximize />}
        </button>
      </div>
      {!isFullscreen && (
        <div className="md:w-1/4 bg-gray-100 p-4 overflow-y-auto">
          {metadata && (
            <>
              <h1 className="text-2xl font-bold">{metadata.name}</h1>
              <p className="mt-2">{metadata.description}</p>
              <h2 className="text-lg font-bold mt-4">Artists</h2>
              <ul>
                {metadata['async-attributes']?.artists.map((artist) => (
                  <li key={artist}>{artist}</li>
                ))}
              </ul>
              <h2 className="text-lg font-bold mt-4">Collector</h2>
              <p className="break-all">{collector}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
