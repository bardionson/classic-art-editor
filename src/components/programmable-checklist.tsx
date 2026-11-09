'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Work = {
  id: string;
  tokenId: string;
  name: string;
  artist: string;
  link: string;
  cid: string | null;
  tags: string[];
  status: string;
  notes: string[];
  mechanics: string[];
  schedule: string[];
  offset: number | null;
  controlCount: number | null;
  source: string | null;
  validation: { cases: number; watcherChecks: number } | null;
  media: {
    total: number;
    checked: number;
    available: number;
    unverified: number;
  };
};
type Report = {
  summary: {
    generatedAt: string;
    catalogMasters: number;
    metadataRead: number;
    metadataUnavailable: number;
    timerWorks: number;
    calendarWorks: number;
    stateCases: number;
    watcherChecks: number;
    timerChecksPassed: number;
    timerReview: number;
    timerRepair: number;
    mediaTotal: number;
    mediaChecked: number;
    mediaAvailable: number;
    listedWorks: number;
  };
  scope: string[];
  works: Work[];
};
const storageKey = 'async-programmable-review-v1';
const labels: Record<string, string> = {
  timer: 'Metadata timers',
  calendar: 'Calendars / anniversaries',
  price: 'Prices',
  external: 'External automation',
  random: 'Random / Tarot',
};
const statuses: Record<string, string> = {
  'timer-checks-passed': 'Timer checks passed',
  'needs-review': 'Needs review',
  'needs-repair': 'Needs repair',
  'needs-restoration': 'Automation not restored',
  'partial-restoration': 'Partly restored',
  'not-validated': 'Not validated',
  'metadata-unverified': 'Metadata unverified',
};
const pageSize = 40;
function offsetLabel(seconds: number) {
  const minutes = Math.abs(seconds) / 60;
  return (
    'UTC' +
    (seconds < 0 ? '−' : '+') +
    String(Math.floor(minutes / 60)).padStart(2, '0') +
    ':' +
    String(minutes % 60).padStart(2, '0')
  );
}
export default function ProgrammableChecklist() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [reviews, setReviews] = useState<Record<string, string>>({});
  const [storageNotice, setStorageNotice] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    fetch('/archive/programmable-audit.json', { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setReport)
      .catch((e) => {
        if (e.name !== 'AbortError')
          setError('The checklist could not load. Reload this page to retry.');
      });
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (saved && typeof saved === 'object' && !Array.isArray(saved))
        setReviews(saved);
    } catch {
      setStorageNotice(
        'This browser could not restore your saved review marks.',
      );
    }
    return () => abort.abort();
  }, []);
  const filtered = useMemo(
    () =>
      report?.works.filter((w) => {
        if (kind !== 'all' && !w.tags.includes(kind)) return false;
        if (
          query &&
          !`${w.name} ${w.artist} ${w.tokenId}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase().trim())
        )
          return false;
        if (filter === 'unchecked' && reviews[w.id]) return false;
        if (filter === 'problem' && reviews[w.id] !== 'problem') return false;
        if (
          filter === 'attention' &&
          w.status === 'timer-checks-passed' &&
          w.media.checked === w.media.total &&
          !w.media.unverified
        )
          return false;
        return true;
      }) || [],
    [report, kind, query, filter, reviews],
  );
  function mark(id: string, value: string) {
    const next = { ...reviews };
    if (value) next[id] = value;
    else delete next[id];
    setReviews(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageNotice('');
    } catch {
      setStorageNotice(
        'Review marks could not be saved in this browser. Export them before leaving.',
      );
    }
  }
  function exportReviews() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              auditDate: report?.summary.generatedAt,
              reviews: report?.works
                .filter((w) => reviews[w.id])
                .map((w) => ({
                  id: w.id,
                  name: w.name,
                  link: 'https://www.async.art' + w.link,
                  review: reviews[w.id],
                })),
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'async-art-my-reviews.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (error)
    return (
      <p role="alert" className="mt-8">
        {error}
      </p>
    );
  if (!report)
    return (
      <p role="status" className="mt-8">
        Loading the restoration checklist…
      </p>
    );
  const s = report.summary;
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / pageSize) - 1),
  );
  return (
    <section className="mt-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          [s.timerWorks, 'Metadata timer pieces'],
          [s.timerChecksPassed, 'Timer checks passed'],
          [s.calendarWorks, 'Calendar / anniversary pieces'],
          [s.listedWorks, 'Automatic works listed'],
        ].map(([number, title]) => (
          <div key={title} className="border border-border rounded-xl p-4">
            <p className="text-3xl font-bold">
              {Number(number).toLocaleString()}
            </p>
            <p className="text-sm text-text-muted">{title}</p>
          </div>
        ))}
      </div>
      <div className="my-6 rounded-xl border border-border p-5 text-sm space-y-3">
        <p>
          <strong>Audit date:</strong>{' '}
          {new Date(s.generatedAt).toLocaleDateString()}. Read{' '}
          {s.metadataRead.toLocaleString()} of{' '}
          {s.catalogMasters.toLocaleString()} cataloged master metadata files.
        </p>
        <p>
          {s.stateCases.toLocaleString()} timer state checks and{' '}
          {s.watcherChecks.toLocaleString()} hourly refresh checks.{' '}
          {s.mediaAvailable.toLocaleString()} image signatures verified out of{' '}
          {s.mediaTotal.toLocaleString()} timer media references;{' '}
          {s.mediaChecked.toLocaleString()} checked.
        </p>
        <p>
          <strong>
            A passed timer check is not a complete restoration certificate.
          </strong>{' '}
          Image checks read only file signatures. Full images, composition, live
          transitions and external inputs still need visual review.
        </p>
        <p>
          This inventory covers automatic changes triggered by time, dates,
          prices and external data. Pieces with only manual collector controls,
          music playback or collector-arranged compositions are excluded. There
          are {s.metadataUnavailable} unread metadata records remain
          unclassified.
        </p>
        <details>
          <summary className="cursor-pointer underline">
            Scope and limitations
          </summary>
          <ul className="list-disc pl-5 mt-3 space-y-2">
            {report.scope.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </details>
      </div>
      <div className="flex flex-wrap gap-4 items-center mb-6 text-sm">
        <a
          className="text-accent underline"
          href="/archive/programmable-audit.json"
          download
        >
          Download full audit
        </a>
        <button className="text-accent underline" onClick={exportReviews}>
          Export my reviews
        </button>
        <span className="text-text-muted">
          Your review marks stay in this browser.
        </span>
      </div>
      {storageNotice && (
        <p role="status" className="mb-4">
          {storageNotice}
        </p>
      )}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <label className="text-sm">
          Find a piece or artist
          <input
            className="block w-full mt-1 border border-border bg-transparent rounded-lg p-3"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Name, artist or token number"
          />
        </label>
        <label className="text-sm">
          Type
          <select
            className="block w-full mt-1 border border-border bg-surface rounded-lg p-3"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All automatic works</option>
            {Object.entries(labels).map(([key, title]) => (
              <option key={key} value={key}>
                {title} (
                {report.works.filter((w) => w.tags.includes(key)).length})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Review filter
          <select
            className="block w-full mt-1 border border-border bg-surface rounded-lg p-3"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All results</option>
            <option value="attention">Needs attention / unverified</option>
            <option value="unchecked">Not reviewed by me</option>
            <option value="problem">Problems I marked</option>
          </select>
        </label>
      </div>
      <p role="status" className="text-sm text-text-muted mb-4">
        {filtered.length.toLocaleString()} matching works · Page{' '}
        {currentPage + 1} of{' '}
        {Math.max(1, Math.ceil(filtered.length / pageSize))}
      </p>
      <div className="space-y-4">
        {filtered
          .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
          .map((w) => (
            <article key={w.id} className="border border-border rounded-xl p-5">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    className="text-xl font-bold text-accent underline break-words"
                    href={w.link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {w.name}
                    {w.tokenId ? ' #' + w.tokenId : ''}
                  </Link>
                  <p className="mt-1 text-text-muted">
                    {w.artist || 'Artist attribution pending'}
                  </p>
                  <p className="mt-2 text-sm">
                    {w.tags.map((t) => labels[t]).join(' · ')}
                  </p>
                </div>
                <label className="text-sm shrink-0">
                  My visual check
                  <select
                    aria-label={`Review ${w.name} ${w.tokenId}`}
                    className="block mt-1 border border-border bg-surface rounded-lg p-2"
                    value={reviews[w.id] || ''}
                    onChange={(e) => mark(w.id, e.target.value)}
                  >
                    <option value="">Not checked</option>
                    <option value="looks-right">Looks right</option>
                    <option value="problem">Found a problem</option>
                  </select>
                </label>
              </div>
              <div className="mt-4 text-sm">
                <h2 className="font-semibold">How it works</h2>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  {w.mechanics.map((mechanic) => (
                    <li key={mechanic}>{mechanic}</li>
                  ))}
                </ul>
              </div>
              <p className="mt-4 font-semibold">{statuses[w.status]}</p>
              {w.validation && (
                <p className="mt-1 text-sm text-text-muted">
                  {w.validation.cases.toLocaleString()} state checks ·{' '}
                  {w.validation.watcherChecks} hourly refresh checks ·{' '}
                  {offsetLabel(w.offset || 0)} (fixed offset)
                </p>
              )}
              <p className="mt-1 text-sm text-text-muted">
                {w.media.total
                  ? `Image signatures: ${w.media.available}/${w.media.total} verified; ${w.media.unverified} unverified after a retrieval attempt; ${w.media.total - w.media.checked} not checked.`
                  : 'Automatic behavior has not been fully validated in this audit.'}
              </p>
              {!!w.notes.length && (
                <ul className="list-disc pl-5 mt-3 text-sm space-y-1">
                  {w.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
              {!!w.schedule.length && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer underline">
                    Original timer rules
                  </summary>
                  <p className="mt-2 text-text-muted">
                    Rule numbers are state indices or transformation values.
                    Month and day-of-month are zero-based; day-of-year is
                    one-based. The recorded fixed UTC offset applies.
                  </p>
                  <ul className="list-disc pl-5 mt-2 space-y-2 break-words">
                    {w.schedule.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="flex flex-wrap gap-4 mt-3 text-sm">
                {w.cid && (
                  <a
                    className="text-accent underline"
                    href={`https://ipfs.filebase.io/ipfs/${w.cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Original metadata
                  </a>
                )}
                {w.source && (
                  <a
                    className="text-accent underline"
                    href={w.source}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Recovered automation source
                  </a>
                )}
              </div>
            </article>
          ))}
      </div>
      {!filtered.length && (
        <p className="my-8">No works match these filters.</p>
      )}
      <div className="flex justify-between mt-6">
        <button
          className="border border-border rounded-lg px-5 py-3 disabled:opacity-40"
          disabled={currentPage === 0}
          onClick={() => setPage(currentPage - 1)}
        >
          Previous
        </button>
        <button
          className="border border-border rounded-lg px-5 py-3 disabled:opacity-40"
          disabled={(currentPage + 1) * pageSize >= filtered.length}
          onClick={() => setPage(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}
