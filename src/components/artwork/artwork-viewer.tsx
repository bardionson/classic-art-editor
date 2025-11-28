'use client';

import { useState } from 'react';
import { XCircle, X, Maximize, Layers } from 'react-feather';
import { Address } from 'viem';
import { useArtwork } from '@/hooks/useArtwork';
import Spinner from '@/components/common/spinner';
import { Modal } from '@/components/common/modal';

const ART_ELEMENT_ID = 'master-art';
const ERROR_MESSAGE = 'Unexpected issue occured.\nPlease try again.';

type ArtworkViewerProps = {
  tokenAddress: Address;
  tokenId: number;
  artContainerClassName?: string;
  detailsContainerClassName?: string;
};

export default function ArtworkViewer({
  tokenAddress,
  tokenId,
  artContainerClassName,
  detailsContainerClassName,
}: ArtworkViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLayersModalOpen, setIsLayersModalOpen] = useState(false);
  const { artElementRef, statusMessage, metadata, collector, error } =
    useArtwork(tokenAddress, tokenId);

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
    <>
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
        <div className="absolute bottom-4 right-4 flex space-x-2">
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
      {!isFullscreen && metadata && (
        <div className={detailsContainerClassName}>
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
        </div>
      )}
      {isLayersModalOpen && (
        <Modal title="Layers" onClose={() => setIsLayersModalOpen(false)}>
          <ul>
            {metadata?.layout.layers.map((layer) => (
              <li key={layer.id}>{layer.id}</li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}
