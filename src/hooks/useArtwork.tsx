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

  const layerBlobUrlsRef = useRef<Record<string, string>>({});

  const {
    statusMessage: metadataStatusMessage,
    metadata,
    collector,
    error,
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
      if (error) return;

      try {
        const getLayerControlTokenValue = createGetLayerControlTokenValueFn(
          tokenId,
          metadata['async-attributes']?.['unminted-token-values'],
          controlOverrides,
        );

        if (!isComponentMountedRef.current) return;

        const layers = await getLayersFromMetadata(
          metadata.layout.layers,
          getLayerControlTokenValue,
        );

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
              (domain) =>
                setLayerStatusMessage(
                  <>
                    Loading layers...
                    <br />
                    Loading {layer.activeStateURI} from{' '}
                    <a target="_blank" href={`https://${domain}`}>
                      {domain}
                    </a>
                  </>,
                ),
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
            if (!isComponentMountedRef.current) return;

            // Wait for this specific layer's image to load
            await loadPromise;

            if (layer.anchor) {
              const anchorImageEl = Array.from(artElement.children).find(
                (el) => el.id === layer.anchor,
              ) as LayerImageElement;
              // If anchor failed to load, it won't be in DOM, so anchorImageEl will be undefined.
              // setAnchorLayer handles undefined by setting anchorLayer to null.
              builder.setAnchorLayer(anchorImageEl);
            }

            const layerImageElement = await builder.build();
            layerImageElement.resize(resizeToFitScreenRatio);
            artElement.appendChild(layerImageElement);
            newLayerHashes[layer.id] = layer.activeStateURI;
          } catch (e: any) {
            console.error(`Failed to load layer ${layer.id}:`, e);
          }
        }

        if (!isComponentMountedRef.current) return;
        setLayerHashes(newLayerHashes);

        artElement.classList.remove('-z-20');
        setLayerStatusMessage('');
      } catch (e: any) {
        console.error(e);
        if (isComponentMountedRef.current) {
          setLayerStatusMessage('');
        }
      }
    };

    renderLayers();
  }, [metadata, masterArtSize, controlOverrides, tokenId, error]);

  return {
    artElementRef,
    statusMessage: metadataStatusMessage || layerStatusMessage,
    metadata,
    collector,
    error,
    layerHashes,
    isLandscape,
    tokenURI,
    artists,
    masterArtSize,
  };
};
