import Link from 'next/link';
import type { Metadata } from 'next';
import ArchiveSearchForm from '@/components/archive-search-form';
import ArchiveNavigation from '@/components/archive-navigation';
import { archiveCoverage, searchArchive } from '@/utils/archive-search';
import { archiveFamilies, familyTitle } from '@/utils/archive-families';

export const metadata: Metadata = { title: 'Search the archive | Async Art' };
export const dynamic = 'force-dynamic';
type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : (value ?? '');

export default function SearchPage({ searchParams }: { searchParams: Params }) {
  const query = first(searchParams.q).slice(0, 300);
  const requested = first(searchParams.family);
  const family = [...archiveFamilies.map((f) => f.id), 'unclassified'].includes(
    requested,
  )
    ? requested
    : 'all';
  const found = searchArchive(
    query,
    family,
    Number(first(searchParams.page)) || 1,
  );
  const pageLink = (page: number) =>
    '/search?' + new URLSearchParams({ q: query, family, page: String(page) });
  return (
    <main className="container mx-auto px-4 py-10 max-w-6xl">
      <h1 className="text-3xl sm:text-4xl font-bold mb-4">
        Search the Async archive
      </h1>
      <p className="text-text-muted mb-6 max-w-3xl">
        Explore art, music, layers, editions, and recovered metadata.{' '}
        {archiveCoverage.total.toLocaleString('en-US')} records are indexed from
        the available catalogs and recovery inventories. Coverage is still
        growing.
      </p>
      <ArchiveNavigation />
      <ArchiveSearchForm query={query} family={family} />
      <p className="my-6 text-sm text-text-muted">
        {found.total.toLocaleString('en-US')} results
        {query ? ` for “${query}”` : ''}. Catalog records can be searchable
        before their artwork is restored. Artist labels from recovery
        inventories remain subject to review.
      </p>
      {found.results.length === 0 ? (
        <div className="rounded-xl border border-border p-8">
          <h2 className="text-xl font-semibold mb-2">No matching records</h2>
          <p className="text-text-muted">
            Try a title, an artist, a metadata CID, or search all collections. A
            missing result does not mean the original artwork is lost.
          </p>
          <Link
            className="inline-block text-accent underline mt-4"
            href={'/search?' + new URLSearchParams({ q: query, family: 'all' })}
          >
            Search all collections
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {found.results.map((record) => (
            <li
              key={record.id}
              className="rounded-xl border border-border bg-surface-raised p-5 min-w-0"
            >
              <p className="text-xs text-text-muted mb-2">
                {familyTitle(record.family)} · {record.kind}
              </p>
              <h2 className="text-xl font-semibold break-words">
                {record.name}
              </h2>
              {record.artist && (
                <p className="mt-1 text-text-muted break-words">
                  {record.artist}
                </p>
              )}
              <p className="text-sm mt-3">
                {record.link
                  ? record.family === 'music' && record.kind === 'Master'
                    ? 'Artwork page available · stem player enabled'
                    : 'Artwork page available · restoration varies by work'
                  : 'Metadata indexed · viewer restoration pending'}
              </p>
              {record.metadataVerified && (
                <p className="text-sm text-success mt-1">
                  Original metadata CID verified
                </p>
              )}
              {record.identityStatus === 'reported' && (
                <p className="text-xs text-text-muted mt-1">
                  Collection and token identity from recovery records;
                  verification pending.
                </p>
              )}
              <dl className="text-xs text-text-muted mt-3 space-y-1 break-all">
                {record.tokenId && (
                  <div>
                    <dt className="inline font-semibold">Token ID: </dt>
                    <dd className="inline">{record.tokenId}</dd>
                  </div>
                )}
                {record.contractAddress && (
                  <div>
                    <dt className="inline font-semibold">Contract: </dt>
                    <dd className="inline">{record.contractAddress}</dd>
                  </div>
                )}
                {record.coreAddress && (
                  <div>
                    <dt className="inline font-semibold">Referenced core: </dt>
                    <dd className="inline">{record.coreAddress}</dd>
                  </div>
                )}
                {record.cid && (
                  <div>
                    <dt className="inline font-semibold">Metadata CID: </dt>
                    <dd className="inline">{record.cid}</dd>
                  </div>
                )}
              </dl>
              <div className="flex flex-wrap gap-4 mt-4 text-sm font-medium">
                {record.link && (
                  <Link href={record.link} className="text-accent underline">
                    Open artwork
                  </Link>
                )}
                {record.cid && (
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${record.cid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline"
                  >
                    View source metadata ↗
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {found.totalPages > 1 && (
        <nav
          aria-label="Search results pages"
          className="flex items-center justify-between gap-3 mt-8"
        >
          {found.page > 1 ? (
            <Link className="btn-secondary" href={pageLink(found.page - 1)}>
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm">
            Page {found.page} of {found.totalPages}
          </span>
          {found.page < found.totalPages ? (
            <Link className="btn-secondary" href={pageLink(found.page + 1)}>
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
