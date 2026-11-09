import Link from 'next/link';
import type { Metadata } from 'next';
import ArtistPortrait from '@/components/artist-portrait';
import ArchivePagination from '@/components/archive-pagination';
import {
  artistCount,
  artistHref,
  artistName,
  browseArtists,
} from '@/utils/artist-profiles';

export const metadata: Metadata = {
  title: 'Artists | Async Art',
  description:
    'Explore restored Async artist profiles and their art, music, and Blueprint projects.',
};
export default async function ArtistsPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const query =
    typeof searchParams.q === 'string' ? searchParams.q.slice(0, 300) : '';
  const found = browseArtists(query, Number(searchParams.page) || 1);
  return (
    <main className="container mx-auto px-4 py-10 sm:py-16 max-w-6xl">
      <p className="text-accent text-xs uppercase tracking-widest font-semibold mb-4">
        The people behind the art
      </p>
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
        Async artists
      </h1>
      <p className="text-lg text-text-muted max-w-3xl mt-5 leading-relaxed">
        Discover the artists and musicians who created on Async. Explore their
        works and projects through profiles recovered from the original site.
      </p>
      <p className="text-sm text-text-muted mt-3">
        {artistCount} restored creator profiles. Biographies and links reflect
        their archived pages; recovery is ongoing.
      </p>
      <form
        action="/artists"
        role="search"
        aria-label="Search artists"
        className="my-8 rounded-2xl border border-border bg-surface-sunken p-5 flex flex-col sm:flex-row items-end gap-4"
      >
        <label className="w-full text-sm font-medium">
          Find an artist
          <input
            name="q"
            type="search"
            maxLength={300}
            defaultValue={query}
            placeholder="Artist name, username, or wallet address"
            className="block w-full mt-2 p-3 rounded-lg border border-border bg-surface-raised"
          />
        </label>
        <button className="btn-primary whitespace-nowrap" type="submit">
          Search artists
        </button>
      </form>
      {query && (
        <p className="mb-5">
          {found.total} {found.total === 1 ? 'artist' : 'artists'} matching “
          {query}”{' '}
          <Link href="/artists" className="text-accent underline ml-3">
            Show all artists
          </Link>
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {found.items.map((profile) => (
          <li key={profile.address} className="min-w-0">
            <Link
              href={artistHref(profile)}
              className="block h-full rounded-2xl border border-border bg-surface-raised p-5 hover:border-accent transition"
            >
              <div className="flex items-center gap-4">
                <ArtistPortrait profile={profile} />
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold break-words">
                    {artistName(profile)}
                  </h2>
                  {profile.username && (
                    <p className="text-sm text-text-muted break-all">
                      @{profile.username}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-sm text-text-muted mt-4 line-clamp-3 whitespace-pre-line">
                {profile.bio ||
                  'Explore this artist’s recovered Async profile.'}
              </p>
              <p className="text-sm text-accent mt-5">
                View profile & projects →
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {!found.total && (
        <p>
          No recovered artist profiles match this search. Try a username or
          wallet address.
        </p>
      )}
      <ArchivePagination
        pathname="/artists"
        params={{ q: query }}
        page={found.page}
        totalPages={found.totalPages}
      />
    </main>
  );
}
