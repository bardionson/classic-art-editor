'use client';

import { useEffect, useRef, useState } from 'react';
import { Address } from 'viem';
import { useTokenMetadata } from '@/hooks/useTokenMetadata';
import { useLayersWithArtists } from '@/hooks/useLayersWithArtists';
import LayerControlList from '@/components/artwork/layer-control-list';
import LayerControlDialog from '@/components/artwork/layer-control-dialog';
import { MirrorSession } from '@/types/mirror';

const POLL_INTERVAL_MS = 1000;

export default function MirrorControlPanel({ code }: { code: string }) {
  // tokenAddress/tokenId are set once and never change for the life of a
  // session, so they're kept separate from `controlOverrides`. Only
  // `controlOverrides` should become a new object reference on a poll tick
  // that actually changes something — LayerControlDialog resets its local,
  // not-yet-submitted edits whenever its `currentValues` prop changes
  // reference (see that component's own effect), so replacing this object
  // unconditionally every ~1s would reset whatever the user just selected
  // before they can hit Preview.
  const [token, setToken] = useState<{
    tokenAddress: Address;
    tokenId: number;
  } | null>();
  const [controlOverrides, setControlOverrides] = useState<
    Record<string, number>
  >({});
  const [ended, setEnded] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const lastOverridesJsonRef = useRef<string>('{}');

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/mirror/${encodeURIComponent(code)}?role=control`,
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
          setControlOverrides(data.controlOverrides);
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
  }, [code]);

  const { metadata, tokenURI } = useTokenMetadata(
    token?.tokenAddress as Address,
    token?.tokenId as number,
  );
  const layers = useLayersWithArtists(token?.tokenAddress, tokenURI);

  const handleStopMirroring = async () => {
    try {
      await fetch(`/api/mirror/${encodeURIComponent(code)}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Mirror DELETE failed:', err);
    }
    setEnded(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  if (ended) {
    return <p className="text-center mt-12">Mirror session ended.</p>;
  }

  if (!token) {
    return <p className="text-center mt-12">Connecting...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">
          {metadata?.name || 'Mirror Controls'}
        </h1>
        <button
          onClick={handleStopMirroring}
          className="text-sm text-red border border-red rounded px-3 py-1"
        >
          Stop Mirroring
        </button>
      </div>
      <LayerControlList layers={layers} onLayerClick={setSelectedLayer} />
      <LayerControlDialog
        layer={selectedLayer}
        isOpen={!!selectedLayer}
        onClose={() => setSelectedLayer(null)}
        onPreview={(_controlTokenId, values) => {
          fetch(`/api/mirror/${encodeURIComponent(code)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          }).catch((err) => console.error('Mirror PATCH failed:', err));
        }}
        currentValues={controlOverrides}
        contractAddress={selectedLayer?.contractAddress}
      />
    </div>
  );
}
