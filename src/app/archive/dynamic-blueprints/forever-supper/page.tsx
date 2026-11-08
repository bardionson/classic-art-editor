import Link from 'next/link';
import editions from '@/data/forever-supper-editions.json';
import ArchiveResults from '@/components/archive-results';
import { supperCore as core, supperItems } from '@/utils/forever-supper';
export const metadata = { title: 'Forever Supper | Async Art' };
export default function ForeverSupper({
  searchParams,
}: {
  searchParams: { slot?: string; q?: string; page?: string };
}) {
  const slot =
    typeof searchParams.slot === 'string' &&
    core.slots.some((s) => s.id === searchParams.slot)
      ? searchParams.slot
      : '';
  const q =
    typeof searchParams.q === 'string' ? searchParams.q.slice(0, 200) : '';
  const matches = supperItems(slot, q);
  const pages = Math.max(1, Math.ceil(matches.length / 24));
  const requested = Number(searchParams.page);
  const page = Math.min(
    pages,
    Number.isSafeInteger(requested) && requested > 0 ? requested : 1,
  );
  const href = (p: number) =>
    `?${new URLSearchParams({ slot, q, page: String(p) })}#expansions`;
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-28 pb-16">
      <Link
        href="/archive/dynamic-blueprints"
        className="text-accent underline"
      >
        Dynamic Blueprints
      </Link>
      <h1 className="text-3xl sm:text-4xl font-bold mt-5 mb-3">
        Forever Supper
      </h1>
      <p className="text-text-muted max-w-3xl mb-6">
        A shared room, made personal through art. Explore the backgrounds,
        characters, furniture and objects created for Async’s first Dynamic
        Blueprint collection.
      </p>
      <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-6 items-start mb-10">
        <figure className="min-w-0">
          <a
            href="/archive/forever-supper/base.jpg"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open original empty room artwork"
          >
            <img
              src="/archive/forever-supper/base.jpg"
              alt="Forever Supper’s original empty room, with a table and wall displays"
              width={4800}
              height={3840}
              className="w-full h-auto rounded-xl"
            />
          </a>
          <figcaption className="text-sm text-text-muted mt-2">
            Original empty-room render · preserved in April 2023
          </figcaption>
        </figure>
        <aside className="rounded-xl border border-border p-5 space-y-4">
          <h2 className="text-xl font-semibold">Restoration in progress</h2>
          <p>
            The original room image, 32-slot layout and 1,242 expansion metadata
            records have been recovered.
          </p>
          <p className="text-sm text-text-muted">
            Interactive assembly is awaiting the separate base-layer images.
            Five collector edition previews and their layer traits have also
            been recovered from OpenSea. More editions are still being
            recovered.
          </p>
          <a href="#expansions" className="btn-primary inline-block">
            Explore expansion items
          </a>
          <details className="text-sm text-text-muted">
            <summary className="cursor-pointer">
              Archive sources and coverage
            </summary>
            <div className="space-y-3 mt-3">
              <p>
                The contract reports 1,884 mints at block{' '}
                {parseInt(core.chain.block, 16).toLocaleString('en-US')}.
                Expansion records are item designs, not a count of minted
                editions.
              </p>
              <p>
                Four historical edition metadata snapshots have also been
                recovered. These are dated records, not verified current
                collector selections.
              </p>
              <ul className="space-y-2">
                {core.editions.map((e) => (
                  <li key={e.tokenId}>
                    <a
                      className="text-accent underline"
                      href={`/archive/forever-supper/edition-${e.tokenId}.json`}
                    >
                      {e.name} · {e.capturedAt.slice(0, 4)}-
                      {e.capturedAt.slice(4, 6)}-{e.capturedAt.slice(6, 8)}{' '}
                      metadata
                    </a>
                  </li>
                ))}
              </ul>
              <p>
                <a
                  className="text-accent underline"
                  href={core.source}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Original collection on the Wayback Machine ↗
                </a>
              </p>
              <p>
                <a
                  className="text-accent underline"
                  href="/archive/forever-supper/core-layout.json"
                >
                  Recovered original layout
                </a>{' '}
                ·{' '}
                <a
                  className="text-accent underline"
                  href="/archive/forever-supper/recovery.json"
                >
                  Recovery evidence
                </a>
              </p>
            </div>
          </details>
        </aside>
      </div>
      <section className="mb-12" aria-labelledby="collector-editions">
        <h2 id="collector-editions" className="text-2xl font-semibold mb-3">
          Recovered collector editions
        </h2>
        <p className="text-text-muted max-w-3xl mb-5">
          Five of 1,884 editions recovered so far. These 500 × 400 previews and
          layer traits were preserved from OpenSea on{' '}
          {editions[0].observedAt.slice(0, 10)}. Their last update date is
          unknown; they show cached arrangements, not verified current
          selections.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {editions.map((e) => (
            <article
              key={e.tokenId}
              className="rounded-xl border border-border overflow-hidden"
            >
              <a
                href={e.localImage}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${e.name} artwork`}
              >
                <img
                  src={e.localImage}
                  alt={e.name}
                  width={500}
                  height={400}
                  loading="lazy"
                  className="w-full h-auto"
                />
              </a>
              <div className="p-4">
                <h3 className="font-semibold">{e.name}</h3>
                <p className="text-sm text-text-muted">
                  Edition #{e.tokenId} · OpenSea snapshot
                </p>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer">
                    View 32 layer choices
                  </summary>
                  <dl className="mt-3 space-y-2">
                    {e.traits
                      .filter((t) =>
                        core.slots.some((s) => s.id === t.trait_type),
                      )
                      .map((t) => (
                        <div key={t.trait_type}>
                          <dt className="text-text-muted">{t.trait_type}</dt>
                          <dd>{t.value}</dd>
                        </div>
                      ))}
                  </dl>
                </details>
                <div className="flex gap-4 mt-4 text-sm">
                  <a
                    href={e.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline"
                  >
                    OpenSea source ↗
                  </a>
                  <a
                    href={`/archive/forever-supper/opensea-${e.tokenId}.json`}
                    className="text-accent underline"
                  >
                    Recovered record
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section id="expansions" className="scroll-mt-24">
        <h2 className="text-2xl font-semibold mb-4">Expansion items</h2>
        <form className="flex flex-wrap gap-3 items-end rounded-xl border border-border p-4 mb-5">
          <label className="flex-1 min-w-[180px]">
            Search items or artists
            <input
              type="search"
              name="q"
              defaultValue={q}
              className="block w-full border border-border rounded-lg bg-surface p-3 mt-1"
            />
          </label>
          <label className="flex-1 min-w-[180px]">
            Artwork slot
            <select
              name="slot"
              defaultValue={slot}
              className="block w-full border border-border rounded-lg bg-surface p-3 mt-1"
            >
              <option value="">All slots</option>
              {core.slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} ({supperItems(s.id).length})
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary" type="submit">
            Filter
          </button>
          <Link
            href="/archive/dynamic-blueprints/forever-supper#expansions"
            className="text-accent underline py-3"
          >
            Clear
          </Link>
        </form>
        <p className="text-text-muted mb-5">
          {matches.length.toLocaleString('en-US')} recovered items
          {slot ? ` · ${slot}` : ''}. Each preview shows the individual
          expansion layer.
        </p>
        {matches.length ? (
          <ArchiveResults records={matches.slice((page - 1) * 24, page * 24)} />
        ) : (
          <p>No items match this search. Try another slot or artist name.</p>
        )}
        {pages > 1 && (
          <nav
            aria-label="Expansion pages"
            className="flex flex-wrap items-center gap-5 mt-8"
          >
            {page > 1 && (
              <Link href={href(page - 1)} className="text-accent underline">
                Previous
              </Link>
            )}
            <span>
              Page {page} of {pages}
            </span>
            {page < pages && (
              <Link href={href(page + 1)} className="text-accent underline">
                Next
              </Link>
            )}
          </nav>
        )}
      </section>
    </main>
  );
}
