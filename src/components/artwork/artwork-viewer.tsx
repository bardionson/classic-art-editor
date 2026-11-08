'use client';

import { IPFS_PATH_GATEWAYS } from '@/utils/ipfs-gateways';

import ArtistName from '@/components/artist-name';
import { useState, useEffect, useRef } from 'react';
import {
  XCircle,
  Maximize,
  X,
  Layers,
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
  // Until the visitor chooses, music opens with its player visible. Derive
  // this from loaded metadata so late loading cannot reopen a closed panel.
  const [descriptionPanelChoice, setIsDescriptionPanelOpen] = useState<
    boolean | null
  >(null);
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
  const hasMusic = !!metadata?.['audio-layout'];
  const isDescriptionPanelOpen = descriptionPanelChoice ?? hasMusic;
  const mobileMusic = isMobile && hasMusic && !hideControls;
  const compactMusic =
    mobileMusic &&
    !mobileDetailsOpen &&
    !isFullscreen &&
    isDescriptionPanelOpen;

  const panelVisible = !hideControls && !isFullscreen && isDescriptionPanelOpen;
  const mobilePanel = isMobile && panelVisible;

  useEffect(() => {
    if (!mobilePanel || !musicPanelRef.current) return;
    const panel = musicPanelRef.current;
    const measure = () => setPlayerHeight(panel.getBoundingClientRect().height);
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    measure();
    return () => observer.disconnect();
  }, [mobilePanel]);

  useEffect(() => {
    if (!artViewportRef.current || !masterArtSize) {
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
  }, [masterArtSize]);

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
        style={{
          top:
            isFullscreen || hideControls
              ? 'var(--site-header-height, 72px)'
              : 'calc(var(--site-header-height, 72px) + 64px)',
          bottom: mobilePanel
            ? playerHeight
            : isFullscreen || hideControls
              ? 0
              : 72,
          right: panelVisible && !isMobile ? 420 : 0,
        }}
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
        <div className="shrink-0" style={{ transform: `scale(${artScale})` }}>
          <div
            id={ART_ELEMENT_ID}
            ref={artElementRef}
            className="relative mx-auto -z-20 shrink-0 !mt-0"
          />
        </div>
      </div>

      {/* Keep the toggle outside the scrolling panel so it cannot be clipped. */}
      {!hideControls && !isFullscreen && (
        <button
          type="button"
          onClick={() => setIsDescriptionPanelOpen(!isDescriptionPanelOpen)}
          aria-expanded={panelVisible}
          aria-controls="artwork-controls"
          style={{ top: 'calc(var(--site-header-height, 72px) + 8px)' }}
          className="fixed right-4 z-40 flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-3 text-sm font-semibold text-text-primary shadow-soft-drop hover:bg-surface-sunken"
        >
          {panelVisible ? (
            <X size={18} aria-hidden="true" />
          ) : (
            <Layers size={18} aria-hidden="true" />
          )}
          {panelVisible
            ? 'Hide controls'
            : metadata?.['audio-layout']
              ? 'Music & layers'
              : 'Layers & details'}
        </button>
      )}

      {/* Floating artwork tools stay clear of the details panel. */}
      {!hideControls && (
        <div
          className={`${mobilePanel ? 'hidden' : 'flex'} absolute bottom-4 left-4 z-40 gap-1 bg-black/40 backdrop-blur-md rounded-full p-1`}
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

      {/* Controls sit beside the art on desktop and below it on mobile. */}
      {!hideControls && (
        <div
          id="artwork-controls"
          ref={musicPanelRef}
          aria-label="Artwork controls and details"
          style={{
            display: panelVisible ? undefined : 'none',
            paddingTop: mobilePanel
              ? undefined
              : 'calc(var(--site-header-height, 72px) + 72px)',
          }}
          className={`fixed ${mobilePanel ? 'bottom-0 max-h-[48dvh] px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]' : 'inset-y-0 px-6 pb-24'} right-0 z-30 w-full sm:w-[420px] bg-surface-raised/95 backdrop-blur-xl border-l border-border overflow-y-auto`}
        >
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
                    href={`${IPFS_PATH_GATEWAYS[0]}${sanitizedHash}`}
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
