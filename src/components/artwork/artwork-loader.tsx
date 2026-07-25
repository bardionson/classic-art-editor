'use client';

import { isValidElement, useEffect, useState } from 'react';
import Image from 'next/image';
import logo from '../../../public/logo/async-logo.svg';
import { MasterArtNFTMetadata } from '@/types/shared';

const SLOW_LOAD_DELAY_MS = 15_000;

type ArtworkLoaderProps = {
  statusMessage: string | React.JSX.Element;
  /**
   * Metadata, once resolved, carries the layer list — used only to show a
   * layer count in the status line. Loading states before metadata resolves
   * simply omit the count rather than fabricating one.
   */
  metadata?: MasterArtNFTMetadata;
};

export default function ArtworkLoader({
  statusMessage,
  metadata,
}: ArtworkLoaderProps) {
  // useArtwork combines two distinct phases into a single `statusMessage`:
  // the metadata-fetch phase always produces a plain string
  // ('Loading NFT metadata...'), while the layer-compositing phase always
  // produces a JSX.Element (it embeds a live link to whichever IPFS gateway
  // is currently loading). That type difference is inherent to how the two
  // hooks are built, not incidental string content, so branching on it here
  // is a reasonably stable way to tell the phases apart without adding a
  // new explicit "phase" return value to the hooks.
  const isLayerPhase = isValidElement(statusMessage);

  const [showSlowNotice, setShowSlowNotice] = useState(false);

  useEffect(() => {
    setShowSlowNotice(false);
    const timer = setTimeout(() => {
      setShowSlowNotice(true);
    }, SLOW_LOAD_DELAY_MS);
    return () => clearTimeout(timer);
    // Arm the timer once per phase transition, not per status message: the
    // layer phase re-renders with a new message on every gateway/layer
    // attempt (often more often than every 15s), so keying this on
    // `statusMessage` itself would keep re-arming the timer and the notice
    // would rarely, if ever, fire during a genuinely slow load.
  }, [isLayerPhase]);
  const layerCount = metadata?.layout?.layers?.length;

  const label = isLayerPhase
    ? layerCount
      ? `Loading ${layerCount} layer${layerCount === 1 ? '' : 's'} from IPFS`
      : 'Loading layers from IPFS'
    : 'Resolving artwork from chain';

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-art-bed">
      <div className="flex flex-col items-center gap-4 px-4 text-center">
        <Image
          src={logo.src}
          width={logo.width}
          height={logo.height}
          alt="Async Art Logo"
          className="h-5 w-auto invert animate-pulse"
        />
        <p className="text-sm text-white/70">{label}</p>
        <div className="h-0.5 w-48 bg-surface-sunken/40 rounded-full artwork-loader-progress-track" />
        <p
          className={`max-w-xs text-xs text-white/40 transition-opacity duration-700 ${
            showSlowNotice ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Large artworks can take up to two minutes to load from IPFS.
        </p>
      </div>
    </div>
  );
}
