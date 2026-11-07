'use client';

import { useEffect, useRef, useState } from 'react';
import { MasterArtNFTMetadata } from '@/types/shared';
import { createGetLayerControlTokenValueFn } from '@/components/master-art-viewer/utils';
import {
  AUDIO_GATEWAYS,
  audioUrl,
  MusicStem,
  resolveMusicStems,
} from '@/utils/music';
import { MusicSnapshot, MusicTransport } from '@/utils/music-transport';

const initial: MusicSnapshot = {
  playing: false,
  loading: false,
  position: 0,
  duration: 0,
  error: null,
};
const time = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const button =
  'rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-sunken disabled:opacity-50';

function StemSession({
  stems,
  gateway,
  compact,
}: {
  stems: MusicStem[];
  gateway: string;
  compact: boolean;
}) {
  const media = useRef<(HTMLAudioElement | null)[]>([]);
  const transport = useRef<MusicTransport | null>(null);
  const [state, setState] = useState(initial);
  const [volume, setVolume] = useState(0.8);

  useEffect(() => {
    const elements = media.current.filter(
      (element): element is HTMLAudioElement => !!element,
    );
    // Restore sources on React Strict Mode's effect replay after cleanup.
    elements.forEach((element, index) => {
      element.src = audioUrl(stems[index].uri, gateway);
    });
    const player = new MusicTransport(elements, setState);
    player.setVolume(0.8);
    transport.current = player;
    return () => {
      player.dispose();
      for (const element of elements) {
        element.removeAttribute('src');
        element.load();
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      {stems.map((stem, index) => (
        <audio
          key={stem.id}
          ref={(element) => {
            media.current[index] = element;
          }}
          src={audioUrl(stem.uri, gateway)}
          preload="metadata"
          aria-label={`Audio stem ${stem.id}`}
        />
      ))}
      <div className="flex gap-2 items-center">
        <button
          className={button}
          onClick={() => {
            if (state.playing || state.loading) transport.current?.pause();
            else void transport.current?.play();
          }}
        >
          {state.loading
            ? 'Cancel loading'
            : state.playing
              ? 'Pause music'
              : 'Play music'}
        </button>
        <button className={button} onClick={() => transport.current?.stop()}>
          Stop
        </button>
        <span className="ml-auto text-xs tabular-nums">
          {time(state.position)} / {time(state.duration)}
        </span>
      </div>
      <label className="block text-xs">
        Position
        <input
          className="block w-full mt-1"
          aria-label="Music position"
          type="range"
          min="0"
          max={state.duration || 1}
          step="0.1"
          value={state.position}
          disabled={!state.duration || state.loading}
          onChange={(event) =>
            transport.current?.seek(Number(event.target.value))
          }
        />
      </label>
      <label
        className={`${compact ? 'hidden' : 'flex'} items-center gap-3 text-xs`}
      >
        Volume
        <input
          className="min-w-0 flex-1"
          aria-label="Music volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => {
            const value = Number(event.target.value);
            setVolume(value);
            transport.current?.setVolume(value);
          }}
        />
      </label>
      {state.loading && (
        <p role="status" className="text-xs text-text-muted">
          Loading all {stems.length} stems from IPFS…
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error} If this continues, choose another audio gateway below.
        </p>
      )}
    </div>
  );
}

export default function MusicPlayer({
  metadata,
  tokenId,
  overrides,
  onPreview,
  compact = false,
}: {
  metadata: MasterArtNFTMetadata;
  tokenId: number;
  overrides: Record<string, number>;
  onPreview: (values: Record<string, number>) => void;
  compact?: boolean;
}) {
  const [stems, setStems] = useState<MusicStem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [gateway, setGateway] = useState(AUDIO_GATEWAYS[0].url);
  useEffect(() => {
    let cancelled = false;
    setStems(null);
    setError(null);
    const getValue = createGetLayerControlTokenValueFn(
      tokenId,
      metadata['async-attributes']?.['unminted-token-values'],
      overrides,
      { strict: true },
    );
    resolveMusicStems(metadata, getValue)
      .then((result) => {
        if (!cancelled) setStems(result);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to read music controls.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [metadata, tokenId, overrides, retry]);

  return (
    <section
      aria-label="Music player"
      className={`${compact ? 'mt-2 p-3' : 'my-5 p-4'} rounded-xl border border-border bg-surface-raised space-y-3 text-text`}
    >
      <h2 className={compact ? 'sr-only' : 'text-lg font-bold'}>
        Listen & explore
      </h2>
      <p className={`${compact ? 'hidden' : ''} text-xs text-text-muted`}>
        Original audio stems, mixed in your browser. Original server mastering
        is still being restored.
      </p>
      {compact && (
        <p className="text-xs text-text-muted">
          Stem mix · original mastering restoration in progress
        </p>
      )}
      {!stems && !error && (
        <p role="status" className="text-sm">
          Reading music controls…
        </p>
      )}
      {error && (
        <div role="alert">
          <p className="text-sm text-danger">{error}</p>
          <button
            className={`${button} mt-2`}
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry music controls
          </button>
        </div>
      )}
      {stems && (
        <>
          <StemSession
            key={`${gateway}:${stems.map((stem) => stem.uri).join(',')}`}
            stems={stems}
            gateway={gateway}
            compact={compact}
          />
          <details className={`${compact ? 'hidden' : ''} text-sm`}>
            <summary className="cursor-pointer py-2">
              Explore {stems.length} stems
            </summary>
            <p className="text-xs text-text-muted mb-3">
              Variants are local previews. Changing a variant or seeking pauses
              music; press Play to listen again.
            </p>
            {stems.map((stem) => (
              <label key={stem.id} className="block mb-3 text-xs">
                {stem.id.replace(/_/g, ' ')}
                <select
                  className="block w-full mt-1 rounded border border-border bg-surface-sunken p-2"
                  aria-label={`${stem.id} variant`}
                  value={stem.stateIndex}
                  onChange={(event) =>
                    onPreview({
                      [`${tokenId + stem.relativeTokenId}-${stem.leverId}`]:
                        Number(event.target.value),
                    })
                  }
                >
                  {stem.options.map((_, index) => (
                    <option key={index} value={index}>
                      Variant {index + 1}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </details>
        </>
      )}
      <label
        className={`${compact ? 'hidden' : 'block'} text-xs text-text-muted`}
      >
        Audio gateway
        <select
          aria-label="Audio gateway"
          value={gateway}
          onChange={(event) => setGateway(event.target.value)}
          className="block w-full mt-1 rounded border border-border bg-surface-sunken p-2 text-text"
        >
          {AUDIO_GATEWAYS.map((item) => (
            <option key={item.url} value={item.url}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
