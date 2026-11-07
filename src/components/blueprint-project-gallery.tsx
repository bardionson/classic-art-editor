import Link from 'next/link';
import ArchivePreview from '@/components/archive-preview';
import ArchivePagination from '@/components/archive-pagination';
import { browseBlueprintProjects } from '@/utils/blueprint-projects';

export default function BlueprintProjectGallery({
  query = '',
  sort = 'largest',
  page = 1,
}: {
  query?: string;
  sort?: string;
  page?: number;
}) {
  const result = browseBlueprintProjects(query, sort, page);
  return (
    <section>
      <h2 className="text-2xl font-semibold mb-3">Blueprint projects</h2>
      <p className="text-text-muted mb-6">
        {result.allProjects.toLocaleString('en-US')} projects ·{' '}
        {result.editions.toLocaleString('en-US')} indexed editions. Open a
        project to browse its pieces. Counts reflect the recovered inventory,
        not total minted supply.
      </p>
      <form
        action="/archive/blueprints"
        role="search"
        aria-label="Find Blueprint projects"
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
          <Link
            href="/archive/blueprints"
            className="text-accent underline ml-3"
          >
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
              {project.artists.join(', ')}
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
          </li>
        ))}
      </ul>
      <ArchivePagination
        pathname="/archive/blueprints"
        params={{ q: query, sort }}
        page={result.page}
        totalPages={result.totalPages}
      />
      <p className="text-sm text-text-muted mt-8">
        Project previews use a representative edition. Images may show earlier
        or unrevealed states.
      </p>
      <Link
        href="/search?family=blueprints"
        className="text-accent underline inline-block mt-3"
      >
        Search all Blueprint editions
      </Link>
    </section>
  );
}
