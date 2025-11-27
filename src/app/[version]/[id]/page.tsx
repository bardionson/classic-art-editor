import ArtworkViewer from '@/components/artwork/artwork-viewer';
import { V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS } from '@/config';
import { Address } from 'viem';

export const dynamic = 'force-dynamic';

export default function ArtworkPage({
  params,
}: {
  params: { version: string; id: string };
}) {
  const { version, id } = params;
  const tokenId = Number(id);
  const tokenAddress =
    version === 'v1' ? V1_CONTRACT_ADDRESS : V2_CONTRACT_ADDRESS;

  if (!tokenAddress) {
    return <div>Invalid version</div>;
  }

  return <ArtworkViewer tokenAddress={tokenAddress as Address} tokenId={tokenId} />;
}
