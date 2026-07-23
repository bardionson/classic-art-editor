// src/app/mirror/[code]/display/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Address } from 'viem';
import ArtworkViewer from '@/components/artwork/artwork-viewer';
import { MirrorSession } from '@/types/mirror';

const POLL_INTERVAL_MS = 1000;

export default function MirrorDisplayPage({
  params,
}: {
  params: { code: string };
}) {
  // tokenAddress/tokenId are set once and never change for the life of a
  // session, so they're kept separate from `overrides`. Only `overrides`
  // needs to become a new object reference on every poll tick that actually
  // changes something — otherwise ArtworkViewer's externalControlOverrides
  // effect (Task 6) would feed useArtwork a "new" object every ~1s even when
  // nothing changed, re-triggering the full layer recomposite on every poll.
  const [token, setToken] = useState<{
    tokenAddress: Address;
    tokenId: number;
  } | null>();
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [ended, setEnded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const lastOverridesJsonRef = useRef<string>('{}');

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/mirror/${encodeURIComponent(params.code)}?role=display`,
        );

        if (res.status === 404) {
          setEnded(true);
          if (intervalRef.current) clearInterval(intervalRef.current);
          return;
        }

        if (!res.ok) {
          console.error(`Mirror poll failed: ${res.status}`);
          return;
        }

        const data = (await res.json()) as MirrorSession;
        setToken(
          (prev) =>
            prev ?? { tokenAddress: data.tokenAddress, tokenId: data.tokenId },
        );

        const overridesJson = JSON.stringify(data.controlOverrides);
        if (overridesJson !== lastOverridesJsonRef.current) {
          lastOverridesJsonRef.current = overridesJson;
          setOverrides(data.controlOverrides);
        }
      } catch (err) {
        console.error('Mirror poll error:', err);
      }
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [params.code]);

  if (ended) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center px-4">
        <p className="text-xl mb-4">This mirror session has ended.</p>
        <Link href="/gallery/masters" className="underline">
          Back to Gallery
        </Link>
      </div>
    );
  }

  if (!token) {
    return <div className="flex items-center justify-center h-screen" />;
  }

  return (
    <ArtworkViewer
      tokenAddress={token.tokenAddress}
      tokenId={token.tokenId}
      artContainerClassName="w-full"
      initialFullscreen
      readOnly
      externalControlOverrides={overrides}
    />
  );
}
