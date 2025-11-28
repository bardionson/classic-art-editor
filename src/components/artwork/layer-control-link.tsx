'use client';

import { useEffect, useState } from 'react';
import { fetchIpfs } from '@/utils/ipfs';
import { LayerArtNFTMetadata } from '@/types/shared';

type LayerControlLinkProps = {
  layer: any;
};

export default function LayerControlLink({ layer }: LayerControlLinkProps) {
  const [metadata, setMetadata] = useState<LayerArtNFTMetadata>();

  useEffect(() => {
    async function fetchLayerMetadata() {
      if (layer.uri) {
        try {
          const response = await fetchIpfs(layer.uri);
          const data = await response.json();
          setMetadata(data);
        } catch (error) {
          console.error('Failed to fetch layer metadata:', error);
        }
      }
    }

    fetchLayerMetadata();
  }, [layer.uri]);

  if (metadata?.controls && metadata.controls.length > 0) {
    return (
      <a
        href={`/layer/${layer.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500"
      >
        {layer.label || layer.id}
      </a>
    );
  }

  return <span>{layer.label || layer.id}</span>;
}
