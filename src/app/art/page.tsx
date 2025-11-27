import ArtworkViewer from '@/components/artwork/artwork-viewer';
import { V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS } from '@/config';
import { Address } from 'viem';

export const dynamic = 'force-dynamic';

export default function ArtPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const version = Array.isArray(searchParams.version)
    ? searchParams.version[0]
    : searchParams.version;
  const id = Array.isArray(searchParams.id) ? searchParams.id[0] : searchParams.id;
  const tokenId = Number(id);
  const tokenAddress =
    version === 'v1'
      ? V1_CONTRACT_ADDRESS
      : version === 'v2'
      ? V2_CONTRACT_ADDRESS
      : undefined;

  if (!tokenAddress || isNaN(tokenId)) {
    return <div>Invalid version or ID</div>;
  }

  return (
    <div className="flex flex-row h-screen">
      <ArtworkViewer
        tokenAddress={tokenAddress as Address}
        tokenId={tokenId}
        artContainerClassName="w-3/4"
        detailsContainerClassName="w-1/4 bg-gray-100 p-4 overflow-y-auto"
      />
    </div>
  );
}
