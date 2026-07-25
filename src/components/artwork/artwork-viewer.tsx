'use client';

import { useState, useEffect } from 'react';
import {
  XCircle,
  Maximize,
  X,
  Layers,
  ChevronRight,
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
import ArtworkLoader from '@/components/artwork/artwork-loader';
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
    <div className="fixed inset-0 bg-art-bed overflow-hidden">
      {/* Full-bleed art viewport */}
      <div className="absolute inset-0 flex items-center justify-center">
        {statusMessage && (
          <>
            {statusMessage === ERROR_MESSAGE ? (
              <div className="w-full fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4">
                <XCircle size={80} className="text-red mx-auto mb-8" />
                <p className="text-white text-center">
                  {ERROR_MESSAGE.split('\n')[0]}
                  <br />
                  {ERROR_MESSAGE.split('\n')[1]}
                </p>
              </div>
            ) : (
              <ArtworkLoader
                statusMessage={statusMessage}
                metadata={metadata}
              />
            )}
          </>
        )}
        <div
          id={ART_ELEMENT_ID}
          ref={artElementRef}
          className="relative mx-auto -z-20"
        />
      </div>

      {/* Consolidated floating control pill */}
      {!hideControls && (
        <div className="absolute bottom-4 right-4 z-20 flex gap-1 bg-black/40 backdrop-blur-md rounded-full p-1">
          <button
            onClick={() => setIsLayersModalOpen(true)}
            className="bg-black/60 hover:bg-black/80 text-white p-2.5 rounded-full transition border border-white/10"
            aria-label="View layer hashes"
          >
            <Layers size={20} />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="bg-black/60 hover:bg-black/80 text-white p-2.5 rounded-full transition border border-white/10"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <X size={20} /> : <Maximize size={20} />}
          </button>
          <button
            onClick={() => setIsMirrorDialogOpen(true)}
            className="bg-black/60 hover:bg-black/80 text-white p-2.5 rounded-full transition border border-white/10"
            aria-label="Mirror to another device"
          >
            <Cast size={20} />
          </button>
          <button
            onClick={handleDownload}
            disabled={!!statusMessage || isDownloading}
            className="bg-black/60 hover:bg-black/80 text-white p-2.5 rounded-full transition border border-white/10 disabled:opacity-50"
            aria-label="Download artwork image"
          >
            {isDownloading ? <Spinner size={20} /> : <Download size={20} />}
          </button>
        </div>
      )}

      {/* Description slide-in overlay */}
      {!isFullscreen && !hideControls && (
        <div
          className={`fixed inset-y-0 right-0 z-30 w-full sm:w-[420px] bg-surface-raised/95 backdrop-blur-xl border-l border-border overflow-y-auto p-6 transition-transform duration-300 ease-out ${
            isDescriptionPanelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/*
            Pull tab, attached to the panel's left edge, moves with the panel's
            transform. This works correctly on desktop for both open and closed
            states (panel is a fixed 420px, so -left-10 always lands inside the
            viewport), and on mobile for the CLOSED state (the panel's left edge
            sits near the viewport's right edge once translated off-screen). But
            on mobile the panel is w-full, so when OPEN its left edge is at the
            viewport's own left edge — -left-10 would place the tab off-screen
            and unreachable (verified: geometrically off-viewport and fails a
            real click). So this tab hides itself on mobile only while open
            (`hidden sm:flex` in that state); the separate close button below
            (sm:hidden, only rendered while open) is the reachable close
            affordance on mobile instead. Reopening on mobile still uses this
            same tab, since its closed-state position is unaffected.
          */}
          <button
            onClick={() => setIsDescriptionPanelOpen(!isDescriptionPanelOpen)}
            className={`absolute top-1/2 -left-10 -translate-y-1/2 flex-col items-center gap-2 max-h-[70vh] bg-surface-raised/95 backdrop-blur-xl border border-border border-r-0 rounded-l-lg py-4 px-2 shadow-soft-drop ${
              isDescriptionPanelOpen ? 'hidden sm:flex' : 'flex'
            }`}
            aria-label={
              isDescriptionPanelOpen
                ? 'Hide artwork details'
                : 'Show artwork details'
            }
          >
            {isDescriptionPanelOpen ? (
              <ChevronRight size={18} className="text-text-muted shrink-0" />
            ) : (
              <>
                <ChevronLeft size={16} className="text-text-muted shrink-0" />
                {metadata?.name ? (
                  <span className="[writing-mode:vertical-rl] rotate-180 text-xs font-medium text-text tracking-wide truncate max-h-48">
                    {metadata.name}
                  </span>
                ) : (
                  <Info size={16} className="text-text-muted shrink-0" />
                )}
              </>
            )}
          </button>

          {/* Mobile-only close button: the edge tab above is unreachable when
              the panel is full-width, so this is the only way to close it
              on small screens. Reopening is still handled by the edge tab
              (visible near the right edge once the panel is closed, since
              -left-10 relative to an off-screen-right panel lands back
              inside the viewport). */}
          {isDescriptionPanelOpen && (
            <button
              onClick={() => setIsDescriptionPanelOpen(false)}
              className="sm:hidden absolute top-4 right-4 z-10 bg-surface-sunken hover:bg-border rounded-full p-2 transition"
              aria-label="Hide artwork details"
            >
              <ChevronRight size={20} className="text-text-muted" />
            </button>
          )}

          {metadata && (
            <>
              {backLink && (
                <Link
                  href={backLink}
                  className="flex items-center text-sm text-text-muted mb-4 hover:text-text transition-colors"
                >
                  <ArrowLeft size={16} className="mr-1" />
                  {backLabel || 'Back'}
                </Link>
              )}
              <h1 className="text-2xl font-bold text-text">{metadata.name}</h1>
              <p className="mt-2 text-text-muted">{metadata.description}</p>
              <h2 className="text-lg font-bold mt-4 text-text">Artists</h2>
              <ul className="text-text-muted">
                {artists.length > 0
                  ? artists.map((artist) => <li key={artist}>{artist}</li>)
                  : metadata['async-attributes']?.artists?.map((artist) => (
                      <li key={artist}>{artist}</li>
                    ))}
              </ul>
              <h2 className="text-lg font-bold mt-4 text-text">Collector</h2>
              <p className="break-all text-text-muted">{collector}</p>
              <LayerControlList
                layers={layersWithArtists}
                onLayerClick={(layer) => setSelectedLayer(layer)}
              />
              <button
                className="mt-6 w-full bg-danger hover:bg-danger/80 text-white font-bold py-2 px-4 rounded transition-colors"
                onClick={() => {
                  const url =
                    'https://docs.google.com/forms/d/e/1FAIpQLSdN7VReSnF3sqDN9blH3u7rS8d4cJEDObWpkb7AK-INUc2T9g/viewform?entry.1408621877=' +
                    encodeURIComponent(window.location.href);
                  window.open(url, '_blank');
                }}
              >
                Report an Issue
              </button>
            </>
          )}
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
