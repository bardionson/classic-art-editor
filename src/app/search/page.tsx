import Link from 'next/link';
import type { Metadata } from 'next';
import ArchiveSearchForm from '@/components/archive-search-form';
import ArchiveNavigation from '@/components/archive-navigation';
import ArchiveResults from '@/components/archive-results';
import {
  archiveCoverage,
  displayStatuses,
  searchArchive,
} from '@/utils/archive-search';
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
  const requestedStatus = first(searchParams.status);
  const status = displayStatuses.some((s) => s.id === requestedStatus)
    ? requestedStatus
    : 'all';
  const found = searchArchive(
    query,
    family,
    Number(first(searchParams.page)) || 1,
    status,
  );
  const pageLink = (page: number) =>
    '/search?' +
    new URLSearchParams({ q: query, family, status, page: String(page) });
  return (
    <main className="container mx-auto px-4 py-10 max-w-6xl">
      <h1 className="text-3xl sm:text-4xl font-bold mb-4">
        Search the Async archive
      </h1>
      <p className="text-text-muted mb-6 max-w-3xl">
        Explore art, music, layers, and editions across all four collections.{' '}
        {archiveCoverage.total.toLocaleString('en-US')} records from the
        available catalogs and recovery inventories are indexed. Coverage is
        still growing.
      </p>
      <ArchiveNavigation />
      <ArchiveSearchForm query={query} family={family} status={status} />
      {query && (
        <nav
          aria-label="Matching collections"
          className="flex flex-wrap gap-3 text-sm mt-5"
        >
          {Object.entries(found.familyCounts).map(([id, count]) => (
            <Link
              key={id}
              className="text-accent underline"
              href={
                '/search?' +
                new URLSearchParams({ q: query, family: id, status: 'all' })
              }
            >
              {familyTitle(id)} ({count.toLocaleString('en-US')})
            </Link>
          ))}
        </nav>
      )}
      <p aria-live="polite" className="mt-6 mb-2 font-medium">
        {found.total.toLocaleString('en-US')} results
        {query ? ` for “${query}”` : ''}
      </p>
      <p className="text-sm text-text-muted mb-6">
        Previews come from catalog images or original metadata. An available
        page or preview does not mean all behavior is restored. Preview lookups
        run as you browse; filters reflect the indexed recovery stage.
      </p>
      {found.results.length === 0 ? (
        <div className="rounded-xl border border-border p-8">
          <h2 className="text-xl font-semibold mb-2">No matching records</h2>
          <p className="text-text-muted">
            Try a title, artist, metadata or image CID, or a contract/token
            pair. A missing result does not mean the original artwork is lost.
          </p>
          <Link
            className="inline-block text-accent underline mt-4"
            href={
              '/search?' +
              new URLSearchParams({ q: query, family: 'all', status: 'all' })
            }
          >
            Search all collections and stages
          </Link>
        </div>
      ) : (
        <ArchiveResults records={found.results} />
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
