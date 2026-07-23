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
  Cast,
  Download,
} from 'react-feather';
import { Address } from 'viem';
import { useArtwork } from '@/hooks/useArtwork';
import { useLayersWithArtists } from '@/hooks/useLayersWithArtists';
import Spinner from '@/components/common/spinner';
import { Modal } from '@/components/common/modal';
import Link from 'next/link';
import LayerControlList from '@/components/artwork/layer-control-list';
import LayerControlDialog from '@/components/artwork/layer-control-dialog';
import MirrorDialog from '@/components/artwork/mirror-dialog';
import {
  downloadFlattenedArtwork,
  buildArtworkFilename,
} from '@/utils/download-artwork';

const ART_ELEMENT_ID = 'master-art';
const ERROR_MESSAGE = 'Unexpected issue occured.\nPlease try again.';

type ArtworkViewerProps = {
  tokenAddress: Address;
  tokenId: number;
  artContainerClassName?: string;
  detailsContainerClassName?: string;
  backLink?: string;
  backLabel?: string;
  initialFullscreen?: boolean;
  externalControlOverrides?: Record<string, number>;
  hideControls?: boolean;
};

export default function ArtworkViewer({
  tokenAddress,
  tokenId,
  artContainerClassName,
  detailsContainerClassName,
  backLink,
  backLabel,
  initialFullscreen = false,
  externalControlOverrides,
  hideControls = false,
}: ArtworkViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(initialFullscreen);
  const [isLayersModalOpen, setIsLayersModalOpen] = useState(false);
  const [isMirrorDialogOpen, setIsMirrorDialogOpen] = useState(false);
  const [isDescriptionPanelOpen, setIsDescriptionPanelOpen] = useState(true);
  const [controlOverrides, setControlOverrides] = useState<
    Record<string, number>
  >({});
  const [selectedLayer, setSelectedLayer] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (externalControlOverrides) {
      setControlOverrides((prev) => ({ ...prev, ...externalControlOverrides }));
    }
  }, [externalControlOverrides]);

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

  const layersWithArtists = useLayersWithArtists(tokenAddress, tokenURI);

  const handleDownload = async () => {
    if (!artElementRef.current || !masterArtSize) return;
    setIsDownloading(true);
    try {
      await downloadFlattenedArtwork(
        artElementRef.current,
        1 / masterArtSize.resizeToFitScreenRatio,
        buildArtworkFilename(metadata?.name, tokenId),
      );
    } catch (err) {
      console.error('Failed to download artwork image:', err);
      alert('Failed to download artwork image. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

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
                  <Spinner
                    size={80}
                    className="text-purple mx-auto mt-12 mb-8"
                  />
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
          {!hideControls && (
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
              <button
                onClick={() => setIsMirrorDialogOpen(true)}
                className="bg-gray-800 text-white p-2 rounded-full"
                aria-label="Mirror to another device"
              >
                <Cast />
              </button>
              <button
                onClick={handleDownload}
                disabled={!!statusMessage || isDownloading}
                className="bg-gray-800 text-white p-2 rounded-full disabled:opacity-50"
                aria-label="Download artwork image"
              >
                {isDownloading ? <Spinner size={24} /> : <Download />}
              </button>
            </div>
          )}
        </div>
        {!isFullscreen && isLandscape && !isDescriptionPanelOpen && (
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
                  className="absolute top-1/2 left-[-1.25rem] bg-gray-800 text-white p-2 rounded-full shadow-soft-drop border-2 border-white hover:bg-black transition"
                  aria-label="Hide description panel"
                >
                  <ChevronLeft size={20} />
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
              <button
                className="mt-6 w-full bg-red hover:bg-red/80 text-white font-bold py-2 px-4 rounded transition-colors"
                onClick={() => {
                  const url =
                    'https://docs.google.com/forms/d/e/1FAIpQLSdN7VReSnF3sqDN9blH3u7rS8d4cJEDObWpkb7AK-INUc2T9g/viewform?entry.1408621877=' +
                    encodeURIComponent(window.location.href);
                  window.open(url, '_blank');
                }}
              >
                Report an Issue
              </button>
            </div>
          )}
        {!hideControls && isLayersModalOpen && (
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
        {!hideControls && isMirrorDialogOpen && (
          <MirrorDialog
            tokenAddress={tokenAddress}
            tokenId={tokenId}
            onClose={() => setIsMirrorDialogOpen(false)}
          />
        )}
      </div>
      {!isFullscreen && !hideControls && (
        <LayerControlList
          layers={layersWithArtists}
          onLayerClick={(layer) => setSelectedLayer(layer)}
        />
      )}
      {!hideControls && (
        <LayerControlDialog
          layer={selectedLayer}
          isOpen={!!selectedLayer}
          onClose={() => setSelectedLayer(null)}
          onPreview={(controlTokenId, values) =>
            setControlOverrides((prev) => ({ ...prev, ...values }))
          }
          currentValues={controlOverrides}
          contractAddress={selectedLayer?.contractAddress}
        />
      )}
    </div>
  );
}
