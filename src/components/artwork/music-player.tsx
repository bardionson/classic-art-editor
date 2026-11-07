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
import { usePreparedAudio } from '@/components/use-prepared-audio';

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
  preparedUrls,
}: {
  preparedUrls?: string[];
  stems: MusicStem[];
  gateway: string;
  compact: boolean;
}) {
  const media = useRef<(HTMLAudioElement | null)[]>([]);
  const transport = useRef<MusicTransport | null>(null);
  const [state, setState] = useState(initial);
  const [volume, setVolume] = useState(0.8);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const seekGesture = useRef<{ position: number; resume: boolean } | null>(
    null,
  );
  const beginSeek = () => {
    if (seekGesture.current) return;
    seekGesture.current = {
      position: state.position,
      resume: state.playing || state.loading,
    };
    setSeekPreview(state.position);
    transport.current?.pause();
  };
  const changeSeek = (position: number) => {
    if (seekGesture.current) {
      seekGesture.current.position = position;
      setSeekPreview(position);
    } else {
      // Assistive controls can change a range without pointer/key gestures.
      const resume = state.playing;
      transport.current?.seek(position);
      if (resume) void transport.current?.play();
    }
  };
  const finishSeek = () => {
    const gesture = seekGesture.current;
    if (!gesture) return;
    seekGesture.current = null;
    setSeekPreview(null);
    transport.current?.seek(gesture.position);
    if (gesture.resume) void transport.current?.play();
  };
  const seekKeys = [
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'PageUp',
    'PageDown',
  ];
  const displayedPosition = seekPreview ?? state.position;

  useEffect(() => {
    const elements = media.current.filter(
      (element): element is HTMLAudioElement => !!element,
    );
    // Restore sources on React Strict Mode's effect replay after cleanup.
    elements.forEach((element, index) => {
      element.src =
        preparedUrls?.[index] ?? audioUrl(stems[index].uri, gateway);
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
          src={preparedUrls?.[index] ?? audioUrl(stem.uri, gateway)}
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
      </div>
      <div>
        <label className="sr-only" htmlFor="music-position">
          Playback position
        </label>
        <input
          id="music-position"
          className="block w-full my-2 cursor-pointer accent-accent"
          aria-label="Music position"
          aria-valuetext={`${time(displayedPosition)} of ${time(state.duration)}`}
          type="range"
          min="0"
          max={state.duration || 1}
          step="0.1"
          value={displayedPosition}
          disabled={!state.duration}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            beginSeek();
          }}
          onPointerUp={finishSeek}
          onPointerCancel={finishSeek}
          onKeyDown={(event) => {
            if (seekKeys.includes(event.key)) beginSeek();
          }}
          onKeyUp={(event) => {
            if (seekKeys.includes(event.key)) finishSeek();
          }}
          onBlur={finishSeek}
          onChange={(event) => changeSeek(Number(event.target.value))}
        />
        <div className="flex justify-between text-xs tabular-nums text-text-muted">
          <span aria-label="Elapsed time">{time(displayedPosition)}</span>
          <span aria-label="Total duration">{time(state.duration)}</span>
        </div>
      </div>
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
          Preparing all {stems.length} stems for playback…
        </p>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error} Try downloading the audio first or choosing another
          source.
        </p>
      )}
    </div>
  );
}

function PreparedStemSession({
  stems,
  gateway,
  compact,
}: {
  stems: MusicStem[];
  gateway: string;
  compact: boolean;
}) {
  const audio = usePreparedAudio(
    stems.map((stem) => stem.uri),
    stems.map((stem) => audioUrl(stem.uri, gateway)),
  );
  return (
    <div className="space-y-3">
      <StemSession
        key={audio.urls ? 'downloaded' : 'stream'}
        stems={stems}
        gateway={gateway}
        compact={compact}
        preparedUrls={audio.urls ?? undefined}
      />
      {!audio.urls && (
        <button
          className={button}
          onClick={() =>
            audio.loading ? audio.cancel() : void audio.prepare()
          }
        >
          {audio.loading ? 'Cancel download' : 'Download audio'}
        </button>
      )}
      <p role="status" className="text-xs text-text-muted">
        {audio.message ||
          'Press Play to stream. Download audio to save the selected stems in this browser for smoother repeat listening.'}
      </p>
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
          <PreparedStemSession
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
              Variants are local previews. Changing a variant pauses music;
              press Play to listen to the new mix.
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
