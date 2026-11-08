'use client';

import { useEffect, useRef, useState } from 'react';
import { imageCandidates } from '@/utils/archive-media';

export default function LayerThumbnail({
  imageUrl,
  name,
}: {
  imageUrl: string;
  name: string;
}) {
  // Remount attempts when switching layers, including within the details modal.
  return <Thumbnail key={imageUrl} imageUrl={imageUrl} name={name} />;
}

function Thumbnail({ imageUrl, name }: { imageUrl: string; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const candidates = imageCandidates(imageUrl).sort(
    (a, b) =>
      Number(b.startsWith('https://alchemy.mypinata.cloud/')) -
      Number(a.startsWith('https://alchemy.mypinata.cloud/')),
  );
  const url = candidates[attempt];

  useEffect(() => {
    if (!host.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  // A gateway can hang without emitting an image error. Start the timeout only
  // when the thumbnail is near the viewport, not while it is offscreen.
  useEffect(() => {
    if (!visible || !url || loaded) return;
    const timer = setTimeout(() => setAttempt((n) => n + 1), 12000);
    return () => clearTimeout(timer);
  }, [visible, url, loaded]);

  return (
    <div
      ref={host}
      className="relative w-full h-full flex items-center justify-center bg-surface-sunken"
    >
      {visible && url && (
        // Original media bypasses Next's failing gateway optimizer and keeps GIFs animated.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt={name}
          referrerPolicy="no-referrer"
          decoding="async"
          className={`absolute inset-0 w-full h-full object-contain ${loaded ? '' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setAttempt((n) => n + 1);
          }}
        />
      )}
      {!loaded && (
        <span role="status" className="p-1 text-xs text-text-muted text-center">
          {url ? 'Loading…' : 'Preview unavailable'}
        </span>
      )}
    </div>
  );
}
