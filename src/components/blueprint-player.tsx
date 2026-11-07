'use client';

import { useEffect, useRef, useState } from 'react';
import { archiveAudioUrl } from '@/utils/audio-delivery';
import ArchivePreview from '@/components/archive-preview';
import { usePreparedAudio } from '@/components/use-prepared-audio';
import {
  imageCandidates,
  metadataPlayback,
  type ArchivePlayback,
} from '@/utils/archive-media';

export default function BlueprintPlayer({
  cid,
  name,
  image,
  animationUrl,
}: {
  cid: string;
  name: string;
  image?: string;
  animationUrl?: string;
}) {
  const [media, setMedia] = useState<ArchivePlayback | null>(() =>
    metadataPlayback({ animation_url: animationUrl }),
  );
  const [loading, setLoading] = useState(!media);
  const [lookupError, setLookupError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState('');
  const [art, setArt] = useState(image);
  const element = useRef<HTMLMediaElement | null>(null);
  const originalCandidates = imageCandidates(media?.source);
  const archive = media ? archiveAudioUrl(media.source) : null;
  const candidates = archive
    ? [archive, ...originalCandidates]
    : originalCandidates;
  const audio = usePreparedAudio(
    media ? [media.source] : [],
    candidates.length ? [candidates[attempt] ?? candidates[0]] : [],
  );
  const url = audio.urls?.[0] ?? candidates[attempt];

  useEffect(() => {
    if (metadataPlayback({ animation_url: animationUrl }) && retry === 0)
      return;
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 26000);
    let cancelled = false;
    setLoading(true);
    setLookupError(false);
    fetch(`/api/archive/preview?cid=${encodeURIComponent(cid)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Metadata unavailable');
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        // Revalidate references at the rendering boundary; never embed metadata HTML.
        setMedia(metadataPlayback({ animation_url: data.media?.source }));
        if (typeof data.image === 'string') setArt(data.image);
        setAttempt(0);
        setReady(false);
      })
      .catch(() => {
        if (!cancelled) setLookupError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
        clearTimeout(deadline);
      });
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(deadline);
    };
  }, [cid, animationUrl, retry]);

  // Bound an unresponsive gateway during startup, without interrupting a loaded track.
  useEffect(() => {
    if (!url || ready || audio.urls || audio.loading) return;
    const timer = setTimeout(() => {
      setAttempt((value) => value + 1);
      setPlaying(false);
      setNotice('Trying another source. Press play when it is ready.');
    }, 20000);
    return () => clearTimeout(timer);
  }, [url, ready, audio.urls, audio.loading]);

  const failover = () => {
    if (audio.urls) {
      setNotice(
        'The downloaded media could not be played by this browser. Open the original media below.',
      );
      return;
    }
    setReady(false);
    setPlaying(false);
    setAttempt((value) => value + 1);
    setNotice('Trying another source. Press play when it is ready.');
  };
  const toggle = async () => {
    const player = element.current;
    if (!player) return;
    if (!player.paused) {
      player.pause();
      return;
    }
    try {
      await player.play();
      setNotice('');
    } catch {
      setNotice(
        'Playback did not start. Try the player controls or another source.',
      );
    }
  };
  const events = {
    onLoadedMetadata: () => setReady(true),
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => setPlaying(false),
    onError: failover,
  };
  return (
    <section aria-label="Edition music player" className="min-w-0">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start">
        <ArchivePreview
          key={`${cid}:${art}`}
          name={name}
          cid={cid}
          image={art}
          large
        />
        <div className="min-w-0 rounded-xl border border-border bg-surface-raised p-4">
          <h2 className="text-xl font-semibold mb-2">Listen to this edition</h2>
          <p className="text-sm text-text-muted mb-4">
            The original minted mix, with its artwork. No wallet required.
          </p>
          {loading ? (
            <p role="status">Finding this edition’s audio…</p>
          ) : media && url ? (
            <>
              {media.kind === 'audio' ? (
                <audio
                  key={url}
                  ref={(node) => {
                    element.current = node;
                  }}
                  src={url}
                  controls
                  preload="metadata"
                  aria-label={`${name} audio`}
                  className="w-full"
                  {...events}
                />
              ) : (
                <video
                  key={url}
                  ref={(node) => {
                    element.current = node;
                  }}
                  src={url}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={`${name} media`}
                  className="w-full max-h-[50vh] rounded-lg"
                  {...events}
                />
              )}
              <button
                type="button"
                onClick={toggle}
                className="btn-primary mt-4 min-h-11 w-full"
              >
                {playing ? 'Pause music' : 'Play music'}
              </button>
              {notice && (
                <p role="status" className="text-sm mt-3">
                  {notice}
                </p>
              )}
              {!audio.urls && (
                <button
                  type="button"
                  className="mt-3 min-h-11 text-accent underline"
                  onClick={() => {
                    element.current?.pause();
                    if (audio.loading) audio.cancel();
                    else void audio.prepare();
                  }}
                >
                  {audio.loading
                    ? 'Cancel download'
                    : 'Download audio for smoother playback'}
                </button>
              )}
              {audio.message && (
                <p role="status" className="text-xs mt-2">
                  {audio.message}
                </p>
              )}
              <div className="flex flex-wrap gap-4 text-sm mt-4">
                <a
                  href={originalCandidates[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  Open original audio / media ↗
                </a>
                {!audio.urls && attempt + 1 < candidates.length && (
                  <button
                    type="button"
                    onClick={failover}
                    className="text-accent underline"
                  >
                    Try another source
                  </button>
                )}
              </div>
            </>
          ) : (
            <div role="status">
              <p>
                {lookupError
                  ? 'This edition’s metadata is temporarily unavailable.'
                  : media
                    ? 'The original audio could not be loaded from the checked sources.'
                    : 'No playable audio reference was found in this edition’s recovered metadata.'}
              </p>
              <button
                type="button"
                className="btn-primary mt-4"
                onClick={() => {
                  setReady(false);
                  setAttempt(0);
                  setNotice('');
                  if (!media || lookupError) setRetry((value) => value + 1);
                }}
              >
                Retry audio
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
