import ArtistName from '@/components/artist-name';
import Link from 'next/link';
import musicBlueprintCatalog from '@/data/music-blueprint-projects.json';
import ArchivePreview from '@/components/archive-preview';
import ArchivePagination from '@/components/archive-pagination';
import { browseBlueprintProjects } from '@/utils/blueprint-projects';

export default function BlueprintProjectGallery({
  query = '',
  sort = 'largest',
  page = 1,
  family = 'blueprints',
}: {
  query?: string;
  sort?: string;
  page?: number;
  family?: 'blueprints' | 'music-blueprints';
}) {
  const result = browseBlueprintProjects(query, sort, page, family);
  const pathname = `/archive/${family}`;
  const title = family === 'music-blueprints' ? 'Music Blueprint' : 'Blueprint';
  return (
    <section>
      <h2 className="text-2xl font-semibold mb-3">{title} projects</h2>
      <p className="text-text-muted mb-6">
        {result.allProjects.toLocaleString('en-US')} projects ·{' '}
        {result.editions.toLocaleString('en-US')} indexed editions. Open a
        project to browse its pieces. Counts reflect the recovered inventory,
        not total minted supply.
      </p>
      {family === 'music-blueprints' && (
        <p className="text-sm text-text-muted mb-6">
          Browse by project and artist, then open an edition to hear its
          original mix alongside the artwork. Multiple projects share the Async
          Music Blueprints contract.{' '}
          <a
            href={musicBlueprintCatalog.sharedContract.collectionUrl}
            className="text-accent underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenSea lists 4,002 items in that shared collection
          </a>
          ; the archive totals above count recovered editions across the
          projects identified so far. Some editions still need their metadata or
          audio recovered.
        </p>
      )}
      <form
        action={pathname}
        role="search"
        aria-label={`Find ${title} projects`}
        className="grid gap-4 sm:grid-cols-[1fr_auto_auto] items-end rounded-xl border border-border bg-surface-sunken p-5 mb-6"
      >
        <label className="block text-sm">
          Project or artist
          <input
            type="search"
            name="q"
            defaultValue={query}
            maxLength={300}
            placeholder="Search projects and artists"
            className="block w-full mt-2 p-3 rounded-lg border border-border bg-surface-raised text-text-primary"
          />
        </label>
        <label className="block text-sm">
          Sort projects
          <select
            name="sort"
            defaultValue={sort}
            className="block w-full mt-2 p-3 rounded-lg border border-border bg-surface-raised text-text-primary"
          >
            <option value="largest">Most indexed editions</option>
            <option value="name">Project name A–Z</option>
          </select>
        </label>
        <button className="btn-primary" type="submit">
          Find projects
        </button>
      </form>
      {query && (
        <p className="mb-5">
          {result.total} matching projects{' '}
          <Link href={pathname} className="text-accent underline ml-3">
            Clear search
          </Link>
        </p>
      )}
      {!result.total && (
        <p className="mb-6">
          No projects match this search. Try a project name or artist.
        </p>
      )}
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {result.projects.map((project) => (
          <li
            key={project.id}
            className="rounded-xl border border-border bg-surface-raised p-4 min-w-0"
          >
            <Link
              href={`/archive/blueprints/project/${project.id}`}
              aria-label={`Browse ${project.name} project`}
            >
              <ArchivePreview
                name={`${project.name} — representative edition`}
                cid={project.cover.cid}
                image={project.cover.image}
              />
            </Link>
            <h3 className="text-lg font-semibold mt-4 break-words">
              <Link
                className="hover:underline"
                href={`/archive/blueprints/project/${project.id}`}
              >
                {project.name}
              </Link>
            </h3>
            <p className="text-sm text-text-muted mt-1 break-words">
              <ArtistName credit={project.artists.join(', ')} />
            </p>
            <p className="text-sm mt-3">
              {project.count.toLocaleString('en-US')} indexed{' '}
              {project.count === 1 ? 'edition' : 'editions'}
            </p>
            <Link
              className="inline-block mt-4 text-accent underline"
              href={`/archive/blueprints/project/${project.id}`}
            >
              Browse editions
            </Link>
            {family === 'music-blueprints' && (
              <Link
                className="block mt-3 text-accent underline"
                href={`/archive/metadata/${project.cover.cid}`}
              >
                Listen to an edition
              </Link>
            )}
          </li>
        ))}
      </ul>
      <ArchivePagination
        pathname={pathname}
        params={{ q: query, sort }}
        page={result.page}
        totalPages={result.totalPages}
      />
      <p className="text-sm text-text-muted mt-8">
        Each project preview shows a representative edition. Blueprint editions
        are fixed once minted.
      </p>
      <Link
        href={`/search?family=${family}`}
        className="text-accent underline inline-block mt-3"
      >
        Search all {title} editions
      </Link>
      {family === 'music-blueprints' && !query && (
        <section
          className="mt-10 border-t border-border pt-6"
          aria-labelledby="awaiting-music"
        >
          <h2 id="awaiting-music" className="text-xl font-semibold mb-3">
            More projects to recover
          </h2>
          <p className="text-sm text-text-muted mb-4">
            These documented Music Blueprints are not yet matched to editions in
            the recovered inventory.
          </p>
          <ul className="space-y-3">
            {musicBlueprintCatalog.awaitingRecovery.map((project) => (
              <li key={project.name}>
                <a
                  className="text-accent underline"
                  href={project.evidenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {project.name}
                </a>{' '}
                — <ArtistName credit={project.artist} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
