import ArtworkViewer from '@/components/artwork/artwork-viewer';
import { V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS } from '@/config';
import { Address } from 'viem';
import artworkOverrides from '@/artwork-overrides.json';

export const dynamic = 'force-dynamic';

export default function ArtworkPage({
  params,
  searchParams,
}: {
  params: { version: string; id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const { version, id } = params;
  const tokenId = Number(id);
  const tokenAddress =
    version === 'v1' ? V1_CONTRACT_ADDRESS : V2_CONTRACT_ADDRESS;

  if (!tokenAddress) {
    return <div>Invalid version</div>;
  }

  // A handful of masters don't composite reliably through this app's
  // client-side layer renderer. For those specific tokens, show the working
  // pre-rendered version from asyncart-revival (a separate project) instead.
  const overrideSlug = (artworkOverrides as Record<string, string>)[
    String(tokenId)
  ];
  if (tokenAddress === V2_CONTRACT_ADDRESS && overrideSlug) {
    return (
      <iframe
        src={`https://asyncart-revival.bardionson.com/${overrideSlug}?view=gallery`}
        className="fixed inset-0 w-full h-full border-0"
        title="Artwork"
      />
    );
  }

  let backLink: string | undefined;
  let backLabel: string | undefined;

  const referrer = searchParams?.referrer;
  if (referrer === 'masters') {
    backLink = '/gallery/masters';
    backLabel = 'Back to Masters Gallery';
  } else if (referrer === 'layers') {
    backLink = '/gallery/layers';
    backLabel = 'Back to Layers Gallery';
  }

  const initialFullscreen = searchParams?.fullscreen === 'true';

  return (
    <ArtworkViewer
      tokenAddress={tokenAddress as Address}
      tokenId={tokenId}
      backLink={backLink}
      backLabel={backLabel}
      initialFullscreen={initialFullscreen}
    />
  );
}
