'use client';

import Image from 'next/image';
import { Address } from 'viem';
import Spinner from '@/components/common/spinner';
import { useLayerDetail } from '@/hooks/useLayerDetail';
import { getMasterLinkForLayer } from '@/utils/layers';

type LayerDetailContentProps = {
  contractAddress: Address;
  tokenId: string;
};

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function LayerDetailContent({
  contractAddress,
  tokenId,
}: LayerDetailContentProps) {
  const { data, isLoading, isError } = useLayerDetail(contractAddress, tokenId);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-text-muted">
        <Spinner />
        <p>Loading layer details...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="py-12 text-center text-text-muted">
        Unable to load this layer&apos;s details right now.
      </div>
    );
  }

  const masterLink = data.masterTokenId
    ? getMasterLinkForLayer(data.masterTokenId)
    : null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-text">{data.name}</h1>

      <div className="aspect-square w-full max-w-sm overflow-hidden rounded-lg bg-surface-sunken relative mx-auto">
        {data.imageUrl ? (
          <Image
            src={data.imageUrl}
            alt={data.name}
            className="object-cover"
            fill
            sizes="(max-width: 768px) 100vw, 384px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted text-sm">
            No image
          </div>
        )}
      </div>

      {data.description && (
        <p className="text-text-muted">{data.description}</p>
      )}

      {data.artistName && (
        <p className="text-sm text-text">
          <span className="text-text-muted">Artist: </span>
          {data.artistName}
        </p>
      )}

      <p className="text-sm text-text">
        <span className="text-text-muted">Token ID: </span>
        {data.tokenId}
      </p>

      <p className="text-sm text-text">
        <span className="text-text-muted">Owner: </span>
        {data.owner ? (
          <a
            href={`https://etherscan.io/address/${data.owner}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            {truncateAddress(data.owner)}
          </a>
        ) : (
          <span className="text-text-muted">Unknown</span>
        )}
      </p>

      {data.attributes && data.attributes.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text mb-2">Attributes</h2>
          <div className="grid grid-cols-2 gap-2">
            {data.attributes.map((attr, i) => (
              <div
                key={i}
                className="bg-surface-raised border border-border rounded-lg px-3 py-2"
              >
                <p className="text-xs text-text-muted">
                  {attr.trait_type || 'Attribute'}
                </p>
                <p className="text-sm text-text">{String(attr.value ?? '')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {masterLink && (
        <a href={masterLink} className="btn-secondary inline-block">
          View on master artwork
        </a>
      )}
    </div>
  );
}
