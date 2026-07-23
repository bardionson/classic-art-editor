import { useState, useEffect, useRef } from 'react';
import { Address } from 'viem';
import { useTokenMetadata } from '@/hooks/useTokenMetadata';
import {
  createGetLayerControlTokenValueFn,
  getLayersFromMetadata,
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
  const [layerStatusMessage, setLayerStatusMessage] = useState<
    string | React.JSX.Element
  >('');
  const [layerHashes, setLayerHashes] = useState<Record<string, string>>({});
  const [layerError, setLayerError] = useState<string>();

  const layerBlobUrlsRef = useRef<Record<string, string>>({});
  // Bumped at the start of every renderLayers() run. Layer image loads and
  // on-chain control reads are async and have no fixed ordering guarantee
  // (IPFS gateway fallbacks, RPC calls), so if controlOverrides changes
  // again before an in-flight run finishes, that older run must detect it's
  // been superseded and stop touching the DOM/state — otherwise it can
  // "win the race" and silently overwrite a newer, correct composite with
  // stale layer values once it finally resolves.
  const renderGenerationRef = useRef(0);

  const {
    statusMessage: metadataStatusMessage,
    metadata,
    collector,
    error: metadataError,
    isLandscape,
    tokenURI,
    masterArtSize,
    artists,
  } = useTokenMetadata(tokenAddress, tokenId);

  useEffect(() => {
    isComponentMountedRef.current = true;
    return () => {
      isComponentMountedRef.current = false;
    };
  }, []);

  // Render Layers (re-runs if metadata or overrides change)
  useEffect(() => {
    const renderLayers = async () => {
      if (!metadata || !masterArtSize || !artElementRef.current) return;
      // If we have an error from metadata fetch, don't try to render
      if (metadataError) return;

      const generation = ++renderGenerationRef.current;
      const isStale = () => generation !== renderGenerationRef.current;

      setLayerError(undefined);

      try {
        const getLayerControlTokenValue = createGetLayerControlTokenValueFn(
          tokenId,
          metadata['async-attributes']?.['unminted-token-values'],
          controlOverrides,
        );

        if (!isComponentMountedRef.current || isStale()) return;

        const layers = await getLayersFromMetadata(
          metadata.layout.layers,
          getLayerControlTokenValue,
        );

        if (!isComponentMountedRef.current || isStale()) return;

        const artElement = artElementRef.current;
        const { width, height, resizeToFitScreenRatio } = masterArtSize;
        const marginTop =
          (window.innerHeight - height * resizeToFitScreenRatio) / 2;

        artElement.style.marginTop = marginTop > 0 ? `${marginTop}px` : `0px`;
        artElement.style.width = `${width * resizeToFitScreenRatio}px`;
        artElement.style.height = `${height * resizeToFitScreenRatio}px`;

        artElement.innerHTML = '';

        const newLayerHashes: Record<string, string> = {};

        // Initiate parallel loading
        const layerBuilders = layers.map((layer) => {
          const builder = new LayerImageBuilder(
            layer.id,
            layer.transformationProperties,
            getLayerControlTokenValue,
          );
          builder.setLayoutVersion(metadata.layout.version || 1);

          const loadTask = async () => {
            const cachedUrl = layerBlobUrlsRef.current[layer.activeStateURI];

            const blobUrl = await builder.loadImage(
              layer.activeStateURI,
              (domain) => {
                if (isStale()) return;
                setLayerStatusMessage(
                  <>
                    Loading layers...
                    <br />
                    Loading {layer.activeStateURI} from{' '}
                    <a target="_blank" href={`https://${domain}`}>
                      {domain}
                    </a>
                  </>,
                );
              },
              cachedUrl,
            );

            if (blobUrl) {
              layerBlobUrlsRef.current[layer.activeStateURI] = blobUrl;
            }
          };

          return {
            layer,
            builder,
            loadPromise: loadTask(),
          };
        });

        // Build and append in strict order
        for (const { layer, builder, loadPromise } of layerBuilders) {
          try {
            if (!isComponentMountedRef.current || isStale()) return;

            // Wait for this specific layer's image to load
            await loadPromise;

            if (!isComponentMountedRef.current || isStale()) return;

            if (layer.anchor) {
              const anchorImageEl = Array.from(artElement.children).find(
                (el) => el.id === layer.anchor,
              ) as LayerImageElement;
              // If anchor failed to load, it won't be in DOM, so anchorImageEl will be undefined.
              // setAnchorLayer handles undefined by setting anchorLayer to null.
              builder.setAnchorLayer(anchorImageEl);
            }

            const layerImageElement = await builder.build();

            if (!isComponentMountedRef.current || isStale()) return;

            layerImageElement.resize(resizeToFitScreenRatio);
            artElement.appendChild(layerImageElement);
            newLayerHashes[layer.id] = layer.activeStateURI;
          } catch (e: any) {
            console.error(`Failed to load layer ${layer.id}:`, e);
          }
        }

        if (!isComponentMountedRef.current || isStale()) return;
        setLayerHashes(newLayerHashes);

        artElement.classList.remove('-z-20');
        setLayerStatusMessage('');
      } catch (e: any) {
        console.error(e);
        if (isComponentMountedRef.current && !isStale()) {
          setLayerStatusMessage('');
          setLayerError(e.message);
        }
      }
    };

    renderLayers();
  }, [metadata, masterArtSize, controlOverrides, tokenId, metadataError]); // metadataError (not layerError/combined error): re-check after a metadata fetch failure so we don't composite stale layers for what might be a new token; depending on layerError here would re-trigger this same effect every time it sets its own error

  // error/statusMessage combine both metadata-fetch and layer-compositing outcomes — only one domain is ever active at a time given the guard above
  return {
    artElementRef,
    statusMessage: metadataStatusMessage || layerStatusMessage,
    metadata,
    collector,
    error: metadataError || layerError,
    layerHashes,
    isLandscape,
    tokenURI,
    artists,
    masterArtSize,
  };
};
