'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy, Check } from 'react-feather';
import { DONATION_ENS, DONATION_ADDRESS } from '@/utils/restoration-donations';

export default function DonationBanner() {
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setError(false);
    } catch {
      setCopied(null);
      setError(true);
    }
  };

  return (
    <aside
      aria-label="Donate to Digital Rescue Lab"
      className="border-b border-accent/20 bg-surface-sunken px-3 py-2 text-center"
    >
      <p className="mb-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-text">
        <span className="font-semibold">
          Independently restored by Digital Rescue Lab
        </span>
        <Link
          href="/about"
          className="text-accent underline underline-offset-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          About this restoration
        </Link>
      </p>
      <div className="mx-auto max-w-[1400px] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
        <a
          href="https://digitalrescuelab.xyz/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-accent hover:underline"
        >
          Donate to keep Async art alive
        </a>
        <span className="text-text-muted">Ethereum donations</span>
        <button
          type="button"
          onClick={() => copy(DONATION_ENS)}
          aria-label="Copy donation ENS name"
          className="inline-flex items-center gap-1.5 rounded px-1 py-1 font-semibold text-accent hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {DONATION_ENS}
          {copied === DONATION_ENS ? (
            <Check size={13} aria-hidden="true" />
          ) : (
            <Copy size={13} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={() => copy(DONATION_ADDRESS)}
          aria-label="Copy donation wallet address"
          className="inline-flex max-w-full items-center gap-1.5 rounded px-1 py-1 hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span className="font-mono text-[11px] break-all text-left">
            {DONATION_ADDRESS}
          </span>
          {copied === DONATION_ADDRESS ? (
            <Check size={13} className="shrink-0" aria-hidden="true" />
          ) : (
            <Copy size={13} className="shrink-0" aria-hidden="true" />
          )}
        </button>
        <span
          role="status"
          className={copied || error ? 'text-accent' : 'sr-only'}
        >
          {error
            ? 'Select the address above to copy it manually.'
            : copied
              ? copied === DONATION_ENS
                ? 'ENS copied'
                : 'Address copied'
              : ''}
        </span>
      </div>
    </aside>
  );
}
