import { useState } from 'react';
import { ChevronRight, Info } from 'react-feather';
import { Address } from 'viem';
import { useLayerDetailModal } from '@/components/layer/layer-detail-provider';

type LayerControlListProps = {
  title?: string;
  layers: any[];
  onLayerClick: (layer: any) => void;
};

export default function LayerControlList({
  layers,
  title = 'Layers',
  onLayerClick,
}: LayerControlListProps) {
  const { openLayer } = useLayerDetailModal();

  if (!layers || layers.length === 0) return null;

  return (
    <div className="w-full mt-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">
        {title} ({layers.length})
      </h2>
      <div className="space-y-4">
        {layers.map((layer, index) => (
          <div
            key={layer.tokenId || index}
            role="button"
            tabIndex={0}
            aria-label={`Edit ${layer.name}`}
            onKeyDown={(event) => {
              if (
                event.target === event.currentTarget &&
                (event.key === 'Enter' || event.key === ' ')
              ) {
                event.preventDefault();
                onLayerClick(layer);
              }
            }}
            onClick={() => onLayerClick(layer)}
            className="flex items-center justify-between p-4 bg-surface-sunken hover:bg-border rounded-lg cursor-pointer transition-colors shadow-sm"
          >
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0 w-10 h-10 bg-border rounded-md flex items-center justify-center text-text-muted font-bold">
                {index + 1}
              </div>
              <div>
                {layer.imageUrl ? (
                  <img
                    src={layer.imageUrl}
                    alt={layer.name}
                    className="w-12 h-12 object-cover rounded-md inline-block mr-4"
                  />
                ) : (
                  <div className="w-12 h-12 bg-border rounded-md inline-block mr-4"></div>
                )}
                <div className="inline-block align-middle">
                  <h3 className="text-lg font-medium text-text">
                    {layer.name}
                    {layer.artistName && (
                      <span className="text-sm text-text-muted font-normal ml-2">
                        (by {layer.artistName})
                      </span>
                    )}
                  </h3>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-border text-text">
                {layer.controls?.length || 0} controls
              </span>
              <button
                type="button"
                aria-label="View layer details"
                onClick={(e) => {
                  e.stopPropagation();
                  openLayer(
                    layer.contractAddress as Address,
                    String(layer.tokenId),
                  );
                }}
                className="text-text-muted hover:text-gray-600 transition-colors"
              >
                <Info size={20} />
              </button>
              <ChevronRight className="text-text-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
