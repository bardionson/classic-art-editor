'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CHECK_INTERVAL, MarketReport } from '@/utils/artwork-market';

const money = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    value,
  );
const time = (value: string) =>
  value.replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
export default function ArtworkPriceChecker() {
  const [report, setReport] = useState<MarketReport>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const pending = useRef<AbortController | null>(null);
  async function refresh() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    try {
      const response = await fetch('/api/artwork-market', {
        cache: 'no-store',
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Price check unavailable.');
      if (controller.signal.aborted) return;
      setReport(result);
      setError('');
      setNow(Date.now());
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : 'Price check unavailable.');
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        if (!controller.signal.aborted) setLoading(false);
      }
    }
  }
  useEffect(() => {
    void refresh();
    const interval = setInterval(() => {
      if (!document.hidden) void refresh();
    }, CHECK_INTERVAL);
    const clock = setInterval(() => setNow(Date.now()), 15_000);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(interval);
      clearInterval(clock);
      document.removeEventListener('visibilitychange', visible);
      pending.current?.abort();
      pending.current = null;
    };
  }, []);
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `async-price-check-${report.checkedAt.replace(/[:.]/g, '-')}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const stale = !!report && Date.parse(report.expiresAt) <= now;
  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? 'Checking prices…' : 'Check prices'}
        </button>
        {report && (
          <button
            type="button"
            className="underline text-accent"
            onClick={download}
          >
            Download this reading
          </button>
        )}
        <p className="text-sm text-text-muted">
          Checks every 5 minutes while this page is open.
        </p>
      </div>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="text-danger">
            {error} {report && 'Previous reading remains below.'}
          </p>
        )}
        {report && (
          <p className="text-sm text-text-muted">
            {stale || error ? 'Previous reading' : 'Latest reading'}:{' '}
            {time(report.checkedAt)} · {report.source}
          </p>
        )}
      </div>
      {report && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            {Object.values(report.prices).map((price) => (
              <section
                key={price.symbol}
                className="rounded-2xl border border-border p-6 bg-surface-raised"
              >
                <h2 className="text-xl font-semibold">
                  {price.symbol === 'ETH' ? 'Ethereum' : 'Bitcoin'} / USD
                </h2>
                <p className="text-3xl font-bold mt-3">{money(price.usd)}</p>
                <p className="mt-2">
                  {price.change24hPercent >= 0 ? '+' : ''}
                  {price.change24hPercent.toFixed(2)}% over the completed
                  24-hour window
                </p>
                <p className="mt-3 text-xs text-text-muted">
                  Last trade: {time(price.tradedAt)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Hourly closes: {time(price.hourly[0].closedAt)} to{' '}
                  {time(price.hourly[24].closedAt)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {money(price.hourly[0].usd)} → {money(price.hourly[24].usd)}
                </p>
              </section>
            ))}
          </div>
          <section className="rounded-2xl border border-border p-6">
            <h2 className="text-2xl font-semibold">
              ETH Boy: calculated next step
            </h2>
            <p className="mt-3 text-text-muted">
              One application of the recovered rules to this price window. This
              does not replay missed days or change the artwork. Its final
              position also needs the previous state; butterfly position and
              appearance include randomness.
            </p>
            <dl className="grid sm:grid-cols-2 gap-4 mt-5">
              <div>
                <dt className="text-sm text-text-muted">Background movement</dt>
                <dd className="font-semibold">
                  {report.ethBoy.backgroundDelta} original-canvas pixels
                </dd>
              </div>
              <div>
                <dt className="text-sm text-text-muted">
                  Butterfly vertical movement
                </dt>
                <dd className="font-semibold">
                  {report.ethBoy.butterflyYDelta} original-canvas pixels
                </dd>
              </div>
              <div>
                <dt className="text-sm text-text-muted">Expression</dt>
                <dd className="font-semibold">{report.ethBoy.face}</dd>
              </div>
              <div>
                <dt className="text-sm text-text-muted">Special-date object</dt>
                <dd className="font-semibold">{report.ethBoy.object}</dd>
              </div>
            </dl>
            {report.gas && report.ethBoy.clothing ? (
              <p className="mt-4 text-sm text-text-muted">
                Current gas estimate: {report.gas.gwei.toFixed(3)} gwei.
                Clothing opacity: green{' '}
                {report.ethBoy.clothing.greenPercent.toFixed(1)}%, red{' '}
                {report.ethBoy.clothing.redPercent.toFixed(1)}%. Uses Ethereum’s
                current gas estimate; equivalence to the old gas provider is
                still being checked.
              </p>
            ) : (
              <p className="mt-4 text-sm text-text-muted">
                Gas reading unavailable; clothing changes have not been
                calculated.
              </p>
            )}
            <div className="flex flex-wrap gap-5 mt-5">
              <Link href="/v2/807" className="text-accent underline">
                View archived ETH Boy
              </Link>
              <a
                href="https://www.trevorjonesart.com/work_collection/ethboy/"
                className="text-accent underline"
              >
                Trevor’s maintained ETH Boy
              </a>
            </div>
          </section>
          <section className="rounded-2xl border border-border p-6">
            <h2 className="text-2xl font-semibold">
              Right Place &amp; Right Time: Bitcoin layer calculations
            </h2>
            <p className="mt-3 text-text-muted">
              24 hourly changes drive the recovered scale, rotation and position
              formulas. These are calculated values, not saved collector
              settings. Milestone graphics and artist-controlled styling are
              outside this check.
            </p>
            <details className="mt-5">
              <summary className="cursor-pointer text-accent">
                Explore all 24 layer changes
              </summary>
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm text-right">
                  <caption className="text-left pb-3 text-text-muted">
                    Scale is a percentage, rotation is in degrees, and X/Y use
                    the original canvas coordinates.
                  </caption>
                  <thead>
                    <tr>
                      {['Hour', 'Scale', 'Rotation', 'X', 'Y'].map((label) => (
                        <th
                          key={label}
                          scope="col"
                          className="p-2 border-b border-border"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.bitcoin.map((row) => (
                      <tr key={row.hour}>
                        {[row.hour, row.scale, row.rotation, row.x, row.y].map(
                          (value, i) => (
                            <td key={i} className="p-2 border-b border-border">
                              {value}
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <Link
              href="/search?q=Right%20Place%20%26%20Right%20Time"
              className="inline-block mt-5 text-accent underline"
            >
              Find the artwork in the archive
            </Link>
          </section>
          <details className="rounded-2xl border border-border p-5">
            <summary className="cursor-pointer">
              Sources and restoration notes
            </summary>
            <div className="mt-4 text-sm text-text-muted space-y-3">
              <p>
                Prices come from Coinbase Exchange, replacing the original
                CryptoCompare feed. The checker requires 25 consecutive
                completed hourly closes and rejects missing or stale data. The
                current quote above is separate from the completed-hour
                calculation.
              </p>
              <p>
                The original Bitcoin script requested a window that could
                include an extra or unfinished candle. This version uses exactly
                24 completed intervals and handles a completely flat market
                without an invalid rotation. Historical visual equivalence
                remains to be verified.
              </p>
              <p>
                No transactions are submitted and no gas-tank funding is needed.
                A reading is cached for up to five minutes; download it to keep
                the exact inputs and outputs. This is not a permanent daily
                history or a background scheduler.
              </p>
              <a
                className="text-accent underline"
                href="https://github.com/asyncart/autonomous-scripts/tree/931217c50a9aae9437605beabdbbb48cd7f670e4"
              >
                Original Async calculation scripts
              </a>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
