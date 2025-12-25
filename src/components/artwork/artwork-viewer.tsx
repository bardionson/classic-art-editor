'use client';

import { useState } from 'react';
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [controlOverrides, setControlOverrides] = useState<
    Record<string, number>
  >({});
  const [selectedLayer, setSelectedLayer] = useState<any>(null);

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
  } = useArtwork(tokenAddress, tokenId, controlOverrides);

  const layers = (
    layersData[tokenAddress as keyof typeof layersData] || []
  ).filter((l: any) => {
    if (!tokenURI) return false;
    // Normalize logic: check if tokenURI contains the masterTokenId (CID)
    // tokenURI might be "ipfs://CID" or "https://.../CID"
    return tokenURI.includes(l.masterTokenId);
  });

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
          className={`relative mx-auto -z-20 ${
            isEditMode ? 'cursor-move' : ''
          }`}
          onMouseDown={(e) => {
            if (!isEditMode || !artElementRef.current || !masterArtSize) return;

            const target = e.target as HTMLImageElement;
            // Check if target is a layer image (has id)
            if (!target.id || !target.classList.contains('absolute')) return;

            // Access custom properties we attached in LayerImageBuilder
            // @ts-ignore
            const transformProps = target.transformationProperties;
            if (!transformProps) return;

            // Determine if layer has positioning controls
            let xControl: any = null;
            let yControl: any = null;

            if (transformProps['fixed-position']) {
              xControl = transformProps['fixed-position'].x;
              yControl = transformProps['fixed-position'].y;
            } else if (transformProps['relative-position']) {
              xControl = transformProps['relative-position'].x;
              yControl = transformProps['relative-position'].y;
            }

            // Must be controllable (object with token-id), not static number
            if (
              !xControl ||
              typeof xControl === 'number' ||
              !yControl ||
              typeof yControl === 'number'
            ) {
              return;
            }

            e.preventDefault(); // Prevent text selection/drag image ghost

            const startX = e.clientX;
            const startY = e.clientY;

            // Get current control values (or default to 0/center if missing)
            // Note: We need the CURRENT value, which might be in controlOverrides or default.
            // Since we don't have easy access to the resolved value here without recalculating,
            // we can infer it from screen position? No, screen position includes scaling.
            // Better: We rely on what's in controlOverrides if present, else we need the "base" value.
            // Problem: If it's not in overrides, we don't know the starting value (on-chain).
            // Solution: We should probably store the *resolved* values in the DOM element too?
            // Or simpler: Just track Delta. But we need to know the ABSOLUTE value to set in overrides.

            // Let's use the element's current rendered position to reverse-engineer the "current" value?
            // currentPixels = (ControlValue - naturalWidth/2) * scale
            // ControlValue = (currentPixels / scale) + naturalWidth/2
            // "currentPixels" is style.left (parsed)

            const currentLeftPixels = parseFloat(target.style.left || '0');
            const currentTopPixels = parseFloat(target.style.top || '0');
            const scale = masterArtSize.resizeToFitScreenRatio;

            // Calculate implied current control value based on position
            // Formula from Builder: left = (ControlValue - width/2) * scale
            // => ControlValue = (left / scale) + width/2
            const startControlX = Math.round(
              currentLeftPixels / scale + target.naturalWidth / 2,
            );
            const startControlY = Math.round(
              currentTopPixels / scale + target.naturalHeight / 2,
            );

            const handleMouseMove = (moveEvent: MouseEvent) => {
              const dx = moveEvent.clientX - startX;
              const dy = moveEvent.clientY - startY;

              // Convert pixel delta to control value delta
              // DeltaControl = DeltaPixels / scale
              const dControlX = Math.round(dx / scale);
              const dControlY = Math.round(dy / scale);

              const newControlX = startControlX + dControlX;
              const newControlY = startControlY + dControlY;

              // Correct key construction based on logic in useArtwork/createGetLayerControlTokenValueFn:
              // layerTokenId = masterTokenId + relativeLayerTokenId
              // key = `${layerTokenId}-${leverId}`
              const xKey = `${tokenId + xControl['token-id']}-${
                xControl['lever-id']
              }`;
              const yKey = `${tokenId + yControl['token-id']}-${
                yControl['lever-id']
              }`;

              setControlOverrides((prev) => ({
                ...prev,
                [xKey]: newControlX,
                [yKey]: newControlY,
              }));
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        />
          <div className="absolute bottom-4 right-4 flex space-x-2 z-10">
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`p-2 rounded-full ${
                isEditMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-white'
              }`}
              title={isEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
            >
              Edit
            </button>
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
          layers={layers}
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
