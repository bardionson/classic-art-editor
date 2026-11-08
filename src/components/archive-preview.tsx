'use client';

import { useEffect, useRef, useState } from 'react';
import {
  archiveImageCandidates,
  archiveImageCachePath,
  isArchiveVideo,
} from '@/utils/archive-media';

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

// Warm each exact original at most once per tab; failures do not trigger loops.
let warming = 0;
const warmQueue: (() => void)[] = [];
const warmRequests = new Map<
  string,
  Promise<{ contentType?: string; ready: boolean }>
>();
function warmImage(path: string) {
  let request = warmRequests.get(path);
  if (!request) {
    request = new Promise<{ contentType?: string; ready: boolean }>(
      (resolve) => {
        const run = () => {
          warming++;
          fetch(`/api/archive/image?path=${encodeURIComponent(path)}`, {
            method: 'POST',
            signal: AbortSignal.timeout(58000),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((r) =>
              resolve({
                ready: r?.status === 'ready',
                contentType: r?.contentType,
              }),
            )
            .catch(() => resolve({ ready: false }))
            .finally(() => {
              warming--;
              warmQueue.shift()?.();
            });
        };
        if (warming < 2) run();
        else warmQueue.push(run);
      },
    );
    warmRequests.set(path, request);
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
  const [cachedType, setCachedType] = useState('');
  const [cacheReady, setCacheReady] = useState(false);
  const video = isArchiveVideo(source) || cachedType.startsWith('video/');
  const candidates = archiveImageCandidates(source);
  const candidate = candidates[attempt];
  const url =
    candidate &&
    attempt === 0 &&
    cacheReady &&
    candidate.startsWith('/api/archive/image?')
      ? candidate + '&ready=1'
      : candidate;
  useEffect(() => {
    const path = archiveImageCachePath(source);
    if (!visible || !path) return;
    let cancelled = false;
    warmImage(path).then((result) => {
      if (cancelled || !result.ready) return;
      setCachedType(result.contentType ?? '');
      setCacheReady(true);
      setAttempt(0);
      setLoaded(false);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, source]);
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
    if (!visible || !url || loaded || video) return;
    const timer = setTimeout(() => setAttempt((n) => n + 1), 15000);
    return () => clearTimeout(timer);
  }, [visible, url, loaded, video]);
  return (
    <div>
      <div
        ref={host}
        className={`relative flex items-center justify-center bg-surface-sunken rounded-lg overflow-hidden ${large ? 'min-h-64' : 'aspect-square'}`}
      >
        {visible && url && video ? (
          large ? (
            <video
              key={url}
              src={url}
              aria-label={name}
              controls
              playsInline
              preload="metadata"
              className="w-full max-h-[75vh] min-h-64 object-contain bg-black"
              onLoadedMetadata={() => setLoaded(true)}
              onError={() => {
                setLoaded(false);
                setAttempt((n) => n + 1);
              }}
            >
              Your browser cannot play this video.
            </video>
          ) : (
            <p className="p-6 text-sm text-text-muted text-center">
              Video artwork · open to play
            </p>
          )
        ) : visible && url ? (
          // Serve cached browsing copies or original media without Next image proxy limits.
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
          href={
            archiveImageCachePath(source)
              ? `/api/archive/image?path=${encodeURIComponent(archiveImageCachePath(source)!)}&original=1`
              : url
          }
          target="_blank"
          rel="noopener noreferrer"
        >
          Open original media ↗
        </a>
      )}
    </div>
  );
}
