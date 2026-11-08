import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ArtistPortrait from '@/components/artist-portrait';
import ArchivePreview from '@/components/archive-preview';
import ArchiveResults from '@/components/archive-results';
import ArchivePagination from '@/components/archive-pagination';
import {
  artistHref,
  artistName,
  artistWorks,
  captureDate,
  getArtistProfile,
  paginate,
  safeProfileUrl,
} from '@/utils/artist-profiles';
import { familyTitle } from '@/utils/archive-families';

type Props = { params: { artist: string }; searchParams: { page?: string } };
export function generateMetadata({ params }: Pick<Props, 'params'>): Metadata {
  const profile = getArtistProfile(params.artist);
  return {
    title: `${profile ? artistName(profile) : 'Artist'} | Async Art`,
    description: profile
      ? `Explore ${artistName(profile)}’s Async artworks and projects.`
      : undefined,
  };
}
export default function ArtistPage({ params, searchParams }: Props) {
  const profile = getArtistProfile(params.artist);
  if (!profile) notFound();
  const works = artistWorks(profile);
  const page = paginate(works.artworks, Number(searchParams.page) || 1);
  const links = (
    [
      ['website', 'Website'],
      ['twitter', 'X / Twitter'],
      ['instagram', 'Instagram'],
    ] as const
  ).flatMap(([kind, label]) => {
    const href = safeProfileUrl(profile[kind], kind);
    return href ? [{ label, href }] : [];
  });
  return (
    <main className="container mx-auto px-4 py-10 max-w-6xl">
      <Link href="/artists" className="text-accent underline text-sm">
        ← All artists
      </Link>
      <section className="mt-8 mb-10 flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
        <ArtistPortrait profile={profile} large />
        <div className="min-w-0 flex-1">
          <p className="text-accent text-xs uppercase tracking-widest font-semibold mb-3">
            Restored artist profile
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight break-words">
            {artistName(profile)}
          </h1>
          {profile.username && (
            <p className="text-text-muted mt-3 break-all">
              @{profile.username}
            </p>
          )}
          {profile.bio ? (
            <p className="mt-5 whitespace-pre-line leading-relaxed max-w-3xl break-words">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-5 text-text-muted">
              No biography was preserved in this profile’s latest archived page.
            </p>
          )}
          {!!links.length && (
            <nav
              aria-label="Artist’s archived external links"
              className="flex flex-wrap gap-5 mt-5"
            >
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  {link.label} ↗
                </a>
              ))}
            </nav>
          )}
          <p className="text-xs text-text-muted mt-5">
            Profile archived {captureDate(profile.captureTimestamp)} ·{' '}
            <a
              className="underline"
              href={profile.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View original on the Wayback Machine
            </a>
          </p>
        </div>
      </section>
      {!!works.total && (
        <nav
          aria-label="Artist’s work"
          className="flex flex-wrap gap-5 border-y border-border py-4 mb-8 text-sm"
        >
          {!!works.projects.length && (
            <a href="#projects" className="text-accent underline">
              {works.projects.length} Blueprint{' '}
              {works.projects.length === 1 ? 'project' : 'projects'}
            </a>
          )}
          {!!works.artworks.length && (
            <a href="#artworks" className="text-accent underline">
              {works.artworks.length} artworks & layers
            </a>
          )}
        </nav>
      )}
      {!!works.projects.length && (
        <section id="projects" className="mb-12 scroll-mt-28">
          <h2 className="text-2xl font-semibold mb-5">Blueprint projects</h2>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {works.projects.map((project) => (
              <li
                key={project.id}
                className="rounded-xl border border-border bg-surface-raised p-4 min-w-0"
              >
                <Link href={`/archive/blueprints/project/${project.id}`}>
                  <ArchivePreview
                    name={project.name}
                    cid={project.cover.cid}
                    image={project.cover.image}
                  />
                  <p className="text-xs text-text-muted mt-4">
                    {familyTitle(project.family)}
                  </p>
                  <h3 className="font-semibold text-xl mt-2 break-words">
                    {project.name}
                  </h3>
                  <p className="text-sm text-accent mt-3">
                    Explore {project.count.toLocaleString('en-US')} linked
                    editions →
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!!works.artworks.length && (
        <section id="artworks" className="scroll-mt-28">
          <h2 className="text-2xl font-semibold mb-5">Artworks & layers</h2>
          <ArchiveResults
            records={page.items}
            annotations={Object.fromEntries(
              profile.works
                .filter((w) => w.basis === 'layer-contribution')
                .map((w) => [
                  w.recordId,
                  'Includes this artist’s layer contribution',
                ]),
            )}
          />
          <ArchivePagination
            pathname={artistHref(profile)}
            params={{}}
            page={page.page}
            totalPages={page.totalPages}
          />
        </section>
      )}
      {!works.total && (
        <section className="rounded-xl border border-border p-6">
          <h2 className="text-xl font-semibold">
            Project links are still being recovered
          </h2>
          <p className="text-text-muted mt-3">
            This artist’s original profile has been preserved. Their works have
            not yet been connected to it in the archive.
          </p>
          <Link
            href={`/search?${new URLSearchParams({ q: profile.name || profile.username })}`}
            className="text-accent underline inline-block mt-4"
          >
            Search their name in the archive
          </Link>
        </section>
      )}
      <details className="mt-10 border-t border-border pt-5 text-sm text-text-muted">
        <summary className="cursor-pointer">
          About this restored profile
        </summary>
        <p className="mt-3">
          The biography and external links come from the archived Async profile
          and may have changed since its capture. Work links use original
          metadata artist wallets, exact and unambiguous artist credits, or
          documented layer contributions to a master. Edition counts reflect
          recovered records.
        </p>
        {works.nameAttributed && (
          <p className="mt-2">
            Some works are linked by their archived artist credit. These name
            matches do not independently verify wallet authorship.
          </p>
        )}
        <p className="mt-2 break-all">
          Archived profile wallet: {profile.address}
        </p>
        {profile.portrait && profile.portraitSourceUrl && (
          <p className="mt-2">
            <a
              href={profile.portraitSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Archived portrait source
            </a>
          </p>
        )}
      </details>
    </main>
  );
}
