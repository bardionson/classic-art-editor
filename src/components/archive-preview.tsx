'use client';

import { useEffect, useRef, useState } from 'react';
import { imageCandidates } from '@/utils/archive-media';

// Bound simultaneous metadata lookups as cards enter the viewport.
let active = 0;
const queue: (() => void)[] = [];
const lookups = new Map<string, Promise<string | null>>();
function lookup(cid: string) {
  let request = lookups.get(cid);
  if (!request) {
    request = new Promise<string | null>((resolve) => {
      const run = () => {
        active++;
        const controller = new AbortController();
        const deadline = setTimeout(() => controller.abort(), 26000);
        fetch(`/api/archive/preview?cid=${encodeURIComponent(cid)}`, {
          signal: controller.signal,
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) =>
            resolve(typeof data?.image === 'string' ? data.image : null),
          )
          .catch(() => resolve(null))
          .finally(() => {
            clearTimeout(deadline);
            active--;
            queue.shift()?.();
          });
      };
      if (active < 4) run();
      else queue.push(run);
    });
    lookups.set(cid, request);
    // Bound this per-tab cache without affecting in-flight callers.
    if (lookups.size > 256) lookups.delete(lookups.keys().next().value!);
  }
  return request;
}

export default function ArchivePreview({
  name,
  cid,
  image,
  large = false,
}: {
  name: string;
  cid: string;
  image?: string;
  large?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [source, setSource] = useState(image ?? '');
  const [attempt, setAttempt] = useState(0);
  const [resolved, setResolved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const candidates = imageCandidates(source);
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
  useEffect(() => {
    if (!visible || url || resolved || !cid) return;
    let cancelled = false;
    setLoading(true);
    lookup(cid).then((value) => {
      if (cancelled) return;
      if (value && value !== source) {
        setSource(value);
        setAttempt(0);
      }
      setResolved(true);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, url, resolved, cid, source]);
  // Some gateways hang without firing an image error. Move to another gateway.
  useEffect(() => {
    if (!visible || !url || loaded) return;
    const timer = setTimeout(() => setAttempt((n) => n + 1), 15000);
    return () => clearTimeout(timer);
  }, [visible, url, loaded]);
  return (
    <div>
      <div
        ref={host}
        className={`relative flex items-center justify-center bg-surface-sunken rounded-lg overflow-hidden ${large ? 'min-h-64' : 'aspect-square'}`}
      >
        {visible && url ? (
          // Unoptimized original images preserve animations and avoid gateway proxy limits.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt={name}
            referrerPolicy="no-referrer"
            className={
              large
                ? 'w-full max-h-[75vh] object-contain'
                : 'w-full h-full object-contain'
            }
            onLoad={() => setLoaded(true)}
            onError={() => {
              setLoaded(false);
              setAttempt((n) => n + 1);
            }}
          />
        ) : (
          <p role="status" className="p-6 text-sm text-text-muted text-center">
            {!visible || loading || (!resolved && !!cid)
              ? 'Loading artwork preview…'
              : 'Preview unavailable from the checked sources'}
          </p>
        )}
      </div>
      {large && loaded && url && (
        <a
          className="inline-block text-accent underline mt-3 text-sm"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open original media ↗
        </a>
      )}
    </div>
  );
}
