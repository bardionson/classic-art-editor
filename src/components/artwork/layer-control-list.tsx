import { useState } from 'react';
import { ChevronRight } from 'react-feather';

type LayerControlListProps = {
  layers: any[];
  onLayerClick: (layer: any) => void;
};

export default function LayerControlList({
  layers,
  onLayerClick,
}: LayerControlListProps) {
  if (!layers || layers.length === 0) return null;

  return (
    <div className="w-full mt-8 px-4 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Layers ({layers.length})</h2>
      <div className="space-y-4">
        {layers.map((layer, index) => (
          <div
            key={layer.tokenId || index}
            onClick={() => onLayerClick(layer)}
            className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors shadow-sm"
          >
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0 w-10 h-10 bg-gray-200 rounded-md flex items-center justify-center text-gray-500 font-bold">
                {index + 1}
              </div>
              <div>
                {layer.imageUrl ? (
                    <img src={layer.imageUrl} alt={layer.name} className="w-12 h-12 object-cover rounded-md inline-block mr-4"/>
                ) : (
                    <div className="w-12 h-12 bg-gray-300 rounded-md inline-block mr-4"></div>
                )}
                <div className="inline-block align-middle">
                  <h3 className="text-lg font-medium text-gray-900">
                    {layer.name}
                    {layer.artistName && (
                      <span className="text-sm text-gray-500 font-normal ml-2">
                        (by {layer.artistName})
                      </span>
                    )}
                  </h3>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                {layer.controls?.length || 0} controls
              </span>
              <ChevronRight className="text-gray-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
