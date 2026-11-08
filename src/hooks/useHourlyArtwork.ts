'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  HOUR_MS,
  HourlyArtwork,
  priceArtworkId,
  renderingOverrides,
} from '@/utils/artwork-hourly';
const EMPTY: Record<string, number> = {};
export function useHourlyArtwork(
  address: string,
  tokenId: number,
  local: Record<string, number>,
) {
  const id = priceArtworkId(address, tokenId);
  const [enabled, setEnabled] = useState(true);
  const [snapshot, setSnapshot] = useState<HourlyArtwork>();
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!id || !enabled) return;
    let stopped = false;
    let current: HourlyArtwork | undefined;
    let controller: AbortController | undefined;
    const refresh = async () => {
      const clock = Date.now();
      setNow(clock);
      if (
        document.hidden ||
        controller ||
        (current &&
          !current.warning &&
          Date.parse(current.hour) === Math.floor(clock / HOUR_MS) * HOUR_MS)
      )
        return;
      controller = new AbortController();
      try {
        const response = await fetch(
          `/api/artwork-market/render?tokenId=${id}`,
          { cache: 'no-store', signal: controller.signal },
        );
        const data = await response.json();
        if (
          !response.ok ||
          data.tokenId !== id ||
          data.mode !== 'independent-hourly-restoration' ||
          !Number.isFinite(Date.parse(data.hour)) ||
          Date.parse(data.hour) > clock
        )
          throw new Error('Hourly update unavailable');
        if (stopped) return;
        current = data;
        setSnapshot((old) =>
          old?.tokenId === id &&
          old.hour === data.hour &&
          old.warning === data.warning
            ? old
            : data,
        );
        setError(data.warning || '');
      } catch {
        if (!stopped) setError('Hourly update delayed');
      } finally {
        controller = undefined;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      stopped = true;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [id, enabled]);
  const active = enabled && snapshot?.tokenId === id ? snapshot : undefined;
  const overrides = useMemo(
    () => renderingOverrides(active?.overrides ?? EMPTY, local),
    [active, local],
  );
  const stale =
    !!active && Date.parse(active.hour) < Math.floor(now / HOUR_MS) * HOUR_MS;
  return { id, enabled, setEnabled, snapshot: active, overrides, error, stale };
}
