import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, BookOpen } from 'react-feather';
import press from '@/data/press.json';

export const metadata: Metadata = {
  title: 'Press archive | Async Art',
  description:
    'Explore reporting, interviews, radio, and announcements about Async Art, its artists, and programmable music.',
};

const publications = Array.from(
  new Set(press.map((item) => item.publication)),
).sort();
const years = Array.from(new Set(press.map((item) => item.date.slice(0, 4))))
  .sort()
  .reverse();
const kinds = Array.from(new Set(press.map((item) => item.kind))).sort();
const topics = Array.from(new Set(press.flatMap((item) => item.topics))).sort();
type Params = Record<string, string | string[] | undefined>;
function value(params: Params, key: string) {
  return typeof params[key] === 'string' ? (params[key] as string) : '';
}
function dateLabel(date: string) {
  return date.length === 4
    ? date
    : new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(date + 'T12:00:00Z'));
}
const field =
  'mt-2 w-full rounded-lg border border-border bg-surface-raised px-3 py-3 text-text';

export default function PressPage({ searchParams }: { searchParams: Params }) {
  const q = value(searchParams, 'q').trim();
  const publication = value(searchParams, 'publication');
  const year = value(searchParams, 'year');
  const kind = value(searchParams, 'kind');
  const topic = value(searchParams, 'topic');
  const filtered = Boolean(q || publication || year || kind || topic);
  const terms = q.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const results = press
    .filter(
      (item) =>
        (!publication || item.publication === publication) &&
        (!year || item.date.startsWith(year)) &&
        (!kind || item.kind === kind) &&
        (!topic || item.topics.includes(topic)) &&
        terms.every((term) =>
          [item.title, item.summary, item.publication, ...item.topics]
            .join(' ')
            .toLocaleLowerCase()
            .includes(term),
        ),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-8 py-10 sm:py-16">
      <Link href="/" className="text-sm text-accent underline">
        Back to the archive
      </Link>
      <div className="mt-8 mb-10 max-w-3xl">
        <p className="text-sm uppercase tracking-widest text-text-muted mb-3">
          In the media
        </p>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
          The story of Async Art.
        </h1>
        <p className="mt-5 text-lg text-text-muted leading-relaxed">
          The artists, the experiments, and the ideas that made programmable art
          possible. Explore a growing collection of reporting, radio, guides,
          and original announcements.
        </p>
        <p className="mt-4 text-sm text-text-muted">
          {press.length} entries · {publications.length} publications ·
          2020–2023
        </p>
      </div>

      {!filtered && (
        <section
          aria-label="Selected coverage"
          className="grid md:grid-cols-3 gap-4 mb-12"
        >
          {press
            .filter((item) => item.featured)
            .map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-2xl border border-border bg-surface-sunken p-6 flex flex-col hover:border-accent transition"
              >
                <span className="flex justify-between gap-4 text-accent font-semibold">
                  {item.publication}
                  <ArrowUpRight size={20} aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-xl font-semibold leading-snug group-hover:underline">
                  {item.title}
                </h2>
                <p className="mt-3 text-sm text-text-muted leading-relaxed">
                  {item.summary}
                </p>
                <span className="mt-auto pt-6 text-xs text-text-muted">
                  {item.kind} · {dateLabel(item.date)}
                </span>
              </a>
            ))}
        </section>
      )}

      <section aria-labelledby="browse-press">
        <h2 id="browse-press" className="text-2xl font-semibold mb-5">
          Browse the press archive
        </h2>
        <form
          action="/press"
          method="get"
          className="rounded-xl border border-border p-5 mb-8"
        >
          <label className="block text-sm font-medium">
            Search coverage
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Artist, artwork, publication, or topic"
              className={field}
            />
          </label>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            {[
              {
                name: 'publication',
                label: 'Publication',
                selected: publication,
                options: publications,
              },
              { name: 'year', label: 'Year', selected: year, options: years },
              {
                name: 'kind',
                label: 'Coverage type',
                selected: kind,
                options: kinds,
              },
              {
                name: 'topic',
                label: 'Topic',
                selected: topic,
                options: topics,
              },
            ].map((filter) => (
              <label key={filter.name} className="text-sm font-medium">
                {filter.label}
                <select
                  name={filter.name}
                  defaultValue={filter.selected}
                  className={field}
                >
                  <option value="">All</option>
                  {filter.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-5 mt-5">
            <button type="submit" className="btn-primary px-5 py-3 rounded-lg">
              Apply filters
            </button>
            {filtered && (
              <Link href="/press" className="text-sm text-accent underline">
                Clear filters
              </Link>
            )}
          </div>
        </form>
        <p className="text-sm text-text-muted mb-4">
          {results.length} {results.length === 1 ? 'entry' : 'entries'}
          {filtered ? ' found' : ' · newest first'}
        </p>
        {results.length === 0 ? (
          <div className="rounded-xl border border-border p-8">
            <p className="font-semibold">No coverage matches these filters.</p>
            <Link
              href="/press"
              className="inline-block mt-3 text-accent underline"
            >
              Show all coverage
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {results.map((item) => (
              <article
                key={item.id}
                className="py-7 grid md:grid-cols-[180px_1fr] gap-3 md:gap-8"
              >
                <div>
                  <p className="font-semibold text-accent">
                    {item.publication}
                  </p>
                  <time
                    dateTime={item.date}
                    className="text-sm text-text-muted"
                  >
                    {dateLabel(item.date)}
                  </time>
                  <p className="text-xs text-text-muted mt-2">{item.kind}</p>
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold leading-snug">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {item.title}
                      <ArrowUpRight
                        size={17}
                        className="inline ml-2"
                        aria-hidden="true"
                      />
                    </a>
                  </h3>
                  <p className="mt-2 text-text-muted leading-relaxed">
                    {item.summary}
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-3 mt-4 text-sm">
                    <a
                      href={'https://web.archive.org/web/*/' + item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline"
                    >
                      Find archived copies
                    </a>
                    {item.evidence && (
                      <a
                        href={item.evidence}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-muted underline"
                      >
                        Listed on the original Async site
                      </a>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="mt-12 rounded-xl bg-surface-sunken border border-border p-6">
        <h2 className="font-semibold flex items-center gap-2">
          <BookOpen size={18} aria-hidden="true" />
          Preserving the record
        </h2>
        <p className="mt-3 text-sm text-text-muted leading-relaxed max-w-3xl">
          This collection is still growing. Several links were recovered from
          Async’s{' '}
          <a
            className="text-accent underline"
            href="https://web.archive.org/web/20220111085858/https://async.art/"
            target="_blank"
            rel="noopener noreferrer"
          >
            January 2022 homepage
          </a>
          . Press releases are labeled separately from reporting. Archived-copy
          links open the Wayback Machine’s capture history; some publishers may
          require a subscription or have no saved copy.
        </p>
        <div className="flex flex-wrap gap-5 mt-4 text-sm">
          <Link href="/artists" className="text-accent underline">
            Meet the artists
          </Link>
          <Link href="/archive/music" className="text-accent underline">
            Explore Async Music
          </Link>
          <Link
            href="/archive/music-blueprints"
            className="text-accent underline"
          >
            Explore Music Blueprints
          </Link>
        </div>
      </aside>
    </main>
  );
}
