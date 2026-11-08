'use client';

import ArtistName from '@/components/artist-name';
import { useState, useEffect, useRef } from 'react';
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
  Music,
} from 'react-feather';
import { Address } from 'viem';
import { useArtwork } from '@/hooks/useArtwork';
import { useLayersWithArtists } from '@/hooks/useLayersWithArtists';
import MusicPlayer from '@/components/artwork/music-player';
import Spinner from '@/components/common/spinner';
import AddressWithEns from '@/components/common/address-with-ens';
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
  const [isMobile, setIsMobile] = useState(false);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [playerHeight, setPlayerHeight] = useState(240);
  const [artScale, setArtScale] = useState(1);
  const musicPanelRef = useRef<HTMLDivElement>(null);
  const artViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

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
  const mobileMusic = isMobile && !!metadata?.['audio-layout'] && !hideControls;
  const compactMusic =
    mobileMusic &&
    !mobileDetailsOpen &&
    !isFullscreen &&
    isDescriptionPanelOpen;

  useEffect(() => {
    if (!compactMusic || !musicPanelRef.current) return;
    const panel = musicPanelRef.current;
    const measure = () => setPlayerHeight(panel.getBoundingClientRect().height);
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    measure();
    return () => observer.disconnect();
  }, [compactMusic]);

  useEffect(() => {
    if (!compactMusic || !artViewportRef.current || !masterArtSize) {
      setArtScale(1);
      return;
    }
    const viewport = artViewportRef.current;
    const measure = () => {
      const { width, height, resizeToFitScreenRatio } = masterArtSize;
      const rect = viewport.getBoundingClientRect();
      setArtScale(
        Math.max(
          0,
          Math.min(
            1,
            (rect.width - 16) / (width * resizeToFitScreenRatio),
            (rect.height - 16) / (height * resizeToFitScreenRatio),
          ),
        ),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    measure();
    return () => observer.disconnect();
  }, [compactMusic, masterArtSize]);

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
      <div
        ref={artViewportRef}
        aria-label="Artwork display"
        style={compactMusic ? { top: 72, bottom: playerHeight } : undefined}
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
      >
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
          className={`relative mx-auto -z-20 shrink-0 ${compactMusic ? '!mt-0' : ''}`}
          style={compactMusic ? { transform: `scale(${artScale})` } : undefined}
        />
      </div>

      {/* Consolidated floating control pill. Anchored bottom-LEFT (not
          right) and given a high z-index so it stays visible and clickable
          even when the description panel (anchored right, z-30, default
          open) is showing — a right-anchored pill previously sat entirely
          underneath the panel on both desktop (420px width) and mobile
          (full width). */}
      {!hideControls && (
        <div
          className={`${compactMusic ? 'hidden' : 'flex'} absolute bottom-4 left-4 z-40 gap-1 bg-black/40 backdrop-blur-md rounded-full p-1`}
        >
          {metadata?.['audio-layout'] && (
            <button
              onClick={() => {
                setIsFullscreen(false);
                setIsDescriptionPanelOpen(true);
                setMobileDetailsOpen(false);
              }}
              className="bg-black/60 hover:bg-black/80 text-white p-2.5 rounded-full transition border border-white/10"
              aria-label="Show music player"
            >
              <Music size={20} />
            </button>
          )}
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
      {!hideControls && (
        <div
          ref={musicPanelRef}
          className={`${isFullscreen ? 'hidden' : ''} fixed ${compactMusic ? 'bottom-0 max-h-[48dvh] px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]' : 'inset-y-0 pt-24 px-6 pb-24'} right-0 z-30 w-full sm:w-[420px] bg-surface-raised/95 backdrop-blur-xl border-l border-border overflow-y-auto transition-transform duration-300 ease-out ${
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
            className={`absolute top-1/2 -left-10 -translate-y-1/2 flex-col items-center gap-2 max-h-[70vh] bg-surface-raised/75 backdrop-blur-xl border border-border border-r-0 rounded-l-lg py-4 px-2 shadow-soft-drop ${
              compactMusic
                ? 'hidden'
                : isDescriptionPanelOpen
                  ? 'hidden sm:flex'
                  : 'flex'
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
          {isDescriptionPanelOpen && !mobileMusic && (
            <button
              onClick={() => setIsDescriptionPanelOpen(false)}
              className="sm:hidden absolute top-20 right-4 z-10 bg-surface-sunken hover:bg-border rounded-full p-2 transition"
              aria-label="Hide artwork details"
            >
              <ChevronRight size={20} className="text-text-muted" />
            </button>
          )}

          {metadata && (
            <>
              {mobileMusic && (
                <div className="flex items-center justify-between gap-2 mb-2">
                  <button
                    className="text-sm text-accent underline py-1"
                    onClick={() => setMobileDetailsOpen((value) => !value)}
                  >
                    {mobileDetailsOpen
                      ? 'Back to art + player'
                      : 'Stems & artwork details'}
                  </button>
                  {compactMusic && (
                    <button
                      className="text-sm text-accent underline py-1"
                      onClick={() => setIsFullscreen(true)}
                    >
                      Full screen art
                    </button>
                  )}
                </div>
              )}
              {backLink && !compactMusic && (
                <Link
                  href={backLink}
                  className="flex items-center text-sm text-text-muted mb-4 hover:text-text transition-colors"
                >
                  <ArrowLeft size={16} className="mr-1" />
                  {backLabel || 'Back'}
                </Link>
              )}
              <h1
                className={`${compactMusic ? 'text-lg truncate' : 'text-2xl'} font-bold text-text`}
              >
                {metadata.name}
              </h1>
              {metadata['audio-layout'] && (
                <MusicPlayer
                  key={`${tokenAddress}:${tokenId}`}
                  metadata={metadata}
                  controlLayers={layersWithArtists}
                  onOpenLayer={setSelectedLayer}
                  compact={compactMusic}
                  tokenId={tokenId}
                  overrides={controlOverrides}
                  onPreview={(values) =>
                    setControlOverrides((prev) => ({ ...prev, ...values }))
                  }
                />
              )}
              <div className={compactMusic ? 'hidden' : ''}>
                {metadata['audio-layout'] && (
                  <LayerControlList
                    title="Music layers"
                    layers={layersWithArtists}
                    onLayerClick={setSelectedLayer}
                  />
                )}
                <p className="mt-2 text-text-muted">{metadata.description}</p>
                <h2 className="text-lg font-bold mt-4 text-text">Artists</h2>
                <ul className="text-text-muted">
                  {artists.length > 0
                    ? artists.map((artist) => (
                        <li key={artist}>
                          <ArtistName credit={artist} />
                        </li>
                      ))
                    : metadata['async-attributes']?.artists?.map((artist) => (
                        <li key={artist}>
                          <ArtistName credit={artist} />
                        </li>
                      ))}
                </ul>
                <h2 className="text-lg font-bold mt-4 text-text">Collector</h2>
                <p className="break-all text-text-muted">
                  {collector && <AddressWithEns address={collector} />}
                </p>
                {!metadata['audio-layout'] && (
                  <LayerControlList
                    layers={layersWithArtists}
                    onLayerClick={setSelectedLayer}
                  />
                )}
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
              </div>
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
          metadataLayers={metadata?.layout.layers}
          masterTokenId={tokenId}
          isMusic={!!metadata?.['audio-layout']}
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
