'use client';

import { useState, useEffect } from 'react';
import {
  XCircle,
  X,
  Maximize,
  Layers,
  ChevronLeft,
  Info,
  ArrowLeft,
} from 'react-feather';
import { Address } from 'viem';
import { useArtwork } from '@/hooks/useArtwork';
import Spinner from '@/components/common/spinner';
import { Modal } from '@/components/common/modal';
import Link from 'next/link';
import LayerControlList from '@/components/artwork/layer-control-list';
import LayerControlDialog from '@/components/artwork/layer-control-dialog';
import layersData from '@/layers.json';
import { fetchIpfs } from '@/utils/ipfs';

const ART_ELEMENT_ID = 'master-art';
const ERROR_MESSAGE = 'Unexpected issue occured.\nPlease try again.';

type ArtworkViewerProps = {
  tokenAddress: Address;
  tokenId: number;
  artContainerClassName?: string;
  detailsContainerClassName?: string;
  backLink?: string;
  backLabel?: string;
};

export default function ArtworkViewer({
  tokenAddress,
  tokenId,
  artContainerClassName,
  detailsContainerClassName,
  backLink,
  backLabel,
}: ArtworkViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLayersModalOpen, setIsLayersModalOpen] = useState(false);
  const [isDescriptionPanelOpen, setIsDescriptionPanelOpen] = useState(true);
  const [controlOverrides, setControlOverrides] = useState<
    Record<string, number>
  >({});
  const [selectedLayer, setSelectedLayer] = useState<any>(null);
  const [layerArtists, setLayerArtists] = useState<Record<string, string>>({});

  const {
    artElementRef,
    statusMessage,
    metadata,
    collector,
    error,
    layerHashes,
    isLandscape,
    tokenURI,
    masterArtSize,
    artists,
  } = useArtwork(tokenAddress, tokenId, controlOverrides);

  const layers = (
    layersData[tokenAddress as keyof typeof layersData] || []
  ).filter((l: any) => {
    if (!tokenURI) return false;
    // Normalize logic: check if tokenURI contains the masterTokenId (CID)
    // tokenURI might be "ipfs://CID" or "https://.../CID"
    return tokenURI.includes(l.masterTokenId);
  }).map((l: any) => ({
    ...l,
    tokenId: parseInt(l.tokenId, 10),
  }));

  // Fetch layer metadata to get artist names
  useEffect(() => {
    const fetchLayerArtists = async () => {
      // Create public client dynamically to avoid hook rules issues or refactoring useArtwork
      const { createPublicClient, http, getContract } = await import('viem');
      const { mainnet, goerli } = await import('wagmi/chains');
      const { V1_CONTRACT_ADDRESS, __PROD__ } = await import('@/config');
      const v1Abi = (await import('@/abis/v1Abi')).default;
      const v2Abi = (await import('@/abis/v2Abi')).default;

      const publicClient = createPublicClient({
        chain: __PROD__ ? mainnet : goerli,
        transport: http(),
      });

      const contract = getContract({
        address: tokenAddress,
        abi: tokenAddress === V1_CONTRACT_ADDRESS ? v1Abi : v2Abi,
        client: publicClient,
      });

      const newLayerArtists: Record<string, string> = {};
      const promises = layers.map(async (layer) => {
        // Skip if already fetched or if we already have the artist name from layers.json
        if (layerArtists[layer.tokenId] || layer.artistName) return;

        try {
          // Fallback to fetching URI from contract if not in JSON (which it isn't)
          let metadataUri = (layer as any).metadataUri;
          if (!metadataUri) {
            try {
              metadataUri = await contract.read.tokenURI([BigInt(layer.tokenId)]);
            } catch (e) {
              console.error(
                `Failed to fetch tokenURI from contract for layer ${layer.tokenId}`,
                e,
              );
              return;
            }
          }

          if (!metadataUri) return;

          // Sanitize URI: remove ipfs:// prefix if present
          const sanitizedUri = metadataUri.startsWith('ipfs://')
            ? metadataUri.replace('ipfs://', '')
            : metadataUri;

          const res = await fetchIpfs(sanitizedUri);
          const data = await res.json();
          // Look for Artist in attributes
          const artistAttr = data.attributes?.find(
            (attr: any) =>
              attr.trait_type === 'Artist' || attr.trait_type === 'Creator',
          );
          if (artistAttr && artistAttr.value && artistAttr.value.trim() !== '') {
            newLayerArtists[layer.tokenId] = artistAttr.value;
          }
        } catch (err) {
          console.error(
            `Failed to fetch metadata for layer ${layer.tokenId}`,
            err,
          );
        }
      });

      await Promise.all(promises);
      if (Object.keys(newLayerArtists).length > 0) {
        setLayerArtists((prev) => ({ ...prev, ...newLayerArtists }));
      }
    };

    if (layers.length > 0) {
      fetchLayerArtists();
    }
  }, [layers, tokenAddress, layerArtists]); // re-run if layers change (which happens when tokenURI loads)

  // Merge fetched artists into layers prop
  const layersWithArtists = layers.map((layer) => ({
    ...layer,
    artistName: layer.artistName || layerArtists[layer.tokenId],
  }));

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
    <div className="flex flex-col w-full h-full">
      <div className="relative flex flex-row h-full w-full">
        <div
          className={`flex items-center justify-center ${
            isFullscreen ? 'w-full h-full' : artContainerClassName || ''
          }`}
        >
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
          <div className="absolute top-4 right-4 flex space-x-2 z-10">
          </div>
          <div className="absolute bottom-4 right-4 flex space-x-2 z-10">
            <button
              onClick={() => setIsLayersModalOpen(true)}
              className="bg-gray-800 text-white p-2 rounded-full"
            >
              <Layers />
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="bg-gray-800 text-white p-2 rounded-full"
            >
              {isFullscreen ? <X /> : <Maximize />}
            </button>
          </div>
        </div>
        {!isFullscreen &&
        isLandscape &&
        !isDescriptionPanelOpen && (
          <button
            onClick={() => setIsDescriptionPanelOpen(true)}
            className="absolute top-1/2 right-4 bg-gray-800 text-white p-2 rounded-full"
          >
            <Info />
          </button>
        )}
      {!isFullscreen &&
          metadata &&
          (isDescriptionPanelOpen || !isLandscape) && (
            <div
              className={`${
                isLandscape
                  ? 'absolute top-0 right-0 h-full w-1/3 bg-black bg-opacity-75 p-4 overflow-y-auto text-white'
                  : detailsContainerClassName
              }`}
            >
          {isLandscape && (
            <button
              onClick={() => setIsDescriptionPanelOpen(false)}
              className="absolute top-1/2 left-[-1rem] bg-gray-800 text-white p-1 rounded-full"
            >
              <ChevronLeft />
            </button>
          )}
          {backLink && (
            <Link
              href={backLink}
              className="flex items-center text-sm text-gray-500 mb-4 hover:text-black transition-colors"
            >
              <ArrowLeft size={16} className="mr-1" />
              {backLabel || 'Back'}
            </Link>
          )}
              <h1 className="text-2xl font-bold">{metadata.name}</h1>
              <p className="mt-2">{metadata.description}</p>
              <h2 className="text-lg font-bold mt-4">Artists</h2>
              <ul>
                {artists.length > 0
                  ? artists.map((artist) => <li key={artist}>{artist}</li>)
                  : metadata['async-attributes']?.artists?.map((artist) => (
                      <li key={artist}>{artist}</li>
                    ))}
              </ul>
              <h2 className="text-lg font-bold mt-4">Collector</h2>
              <p className="break-all">{collector}</p>
            </div>
          )}
        {isLayersModalOpen && (
          <Modal title="Layers" onClose={() => setIsLayersModalOpen(false)}>
            <ul>
              {metadata?.layout.layers.map((layer) => {
                const hash = layerHashes[layer.id];
                if (!hash)
                  return <li key={layer.id}>{layer.id}: Not Available</li>;

                const sanitizedHash = hash.startsWith('ipfs://')
                  ? hash.slice(7)
                  : hash;

                return (
                  <li key={layer.id} className="break-all">
                    {layer.id}:{' '}
                    <a
                      href={`https://ipfs.io/ipfs/${sanitizedHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      ipfs
                    </a>
                  </li>
                );
              })}
            </ul>
          </Modal>
        )}
      </div>
      {!isFullscreen && (
        <LayerControlList
          layers={layersWithArtists}
          onLayerClick={(layer) => setSelectedLayer(layer)}
        />
      )}
      <LayerControlDialog
        layer={selectedLayer}
        isOpen={!!selectedLayer}
        onClose={() => setSelectedLayer(null)}
        onPreview={(controlTokenId, values) =>
          setControlOverrides((prev) => ({ ...prev, ...values }))
        }
        currentValues={controlOverrides}
      />
    </div>
  );
}
