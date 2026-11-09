import Link from 'next/link';
import { Address } from 'viem';
import LayerDetailContent from '@/components/layer/layer-detail-content';

export const dynamic = 'force-dynamic';

export default async function LayerDetailPage(props: {
  params: Promise<{ contract: string; tokenId: string }>;
}) {
  const params = await props.params;
  const { contract, tokenId } = params;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/gallery/layers"
        className="inline-block mb-6 text-sm text-text-muted hover:text-text transition-colors"
      >
        &larr; Back to Layers Gallery
      </Link>
      <LayerDetailContent
        contractAddress={contract as Address}
        tokenId={tokenId}
      />
    </div>
  );
}
