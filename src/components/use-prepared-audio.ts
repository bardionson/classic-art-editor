'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareAudio } from '@/utils/audio-cache';

export function usePreparedAudio(sources: string[], preferred: string[]) {
  const [urls, setUrls] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const active = useRef<AbortController | null>(null);
  const owned = useRef<string[]>([]);
  useEffect(
    () => () => {
      active.current?.abort();
      owned.current.forEach(URL.revokeObjectURL);
    },
    [],
  );
  const cancel = () => {
    active.current?.abort();
    active.current = null;
    setLoading(false);
    setMessage('Download cancelled. You can retry.');
  };
  const prepare = async () => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    const bytes = sources.map(() => 0);
    const result: string[] = [];
    let completed = 0;
    let cached = 0;
    let saved = 0;
    let next = 0;
    try {
      // Limit concurrent downloads, especially on phones. Keep total mix bounded.
      await Promise.all(
        Array.from({ length: Math.min(2, sources.length) }, async () => {
          while (next < sources.length) {
            const index = next++;
            const item = await prepareAudio(
              sources[index],
              controller.signal,
              (size) => {
                bytes[index] = size;
                const total = bytes.reduce((sum, n) => sum + n, 0);
                if (total > 256 * 1024 * 1024) {
                  throw new Error(
                    'This mix is too large to download on this device. Use streaming.',
                  );
                }
                if (!controller.signal.aborted)
                  setMessage(
                    `Preparing audio: ${completed}/${sources.length} ready · ${(total / 1048576).toFixed(1)} MB`,
                  );
              },
              preferred[index],
            );
            controller.signal.throwIfAborted();
            result[index] = URL.createObjectURL(item.blob);
            completed++;
            if (item.cached) cached++;
            if (item.saved) saved++;
          }
        }),
      );
      controller.signal.throwIfAborted();
      owned.current = result;
      setUrls(result);
      setMessage(
        `Audio ready. Press Play. ${cached === sources.length ? 'Loaded from this browser’s cache.' : saved === sources.length ? 'Saved in this browser for future listens.' : 'Downloaded for this visit; browser storage is unavailable or full.'}`,
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage(
          error instanceof Error
            ? error.message
            : 'Download failed. Please retry.',
        );
      controller.abort();
      result.forEach(URL.revokeObjectURL);
    } finally {
      if (active.current === controller) {
        active.current = null;
        setLoading(false);
      }
    }
  };
  return { urls, loading, message, prepare, cancel };
}
