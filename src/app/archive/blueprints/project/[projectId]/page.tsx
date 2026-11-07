import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ArchiveResults from '@/components/archive-results';
import ArchivePagination from '@/components/archive-pagination';
import { getBlueprintProject } from '@/utils/blueprint-projects';
import { searchArchive } from '@/utils/archive-search';

export function generateMetadata({
  params,
}: {
  params: { projectId: string };
}): Metadata {
  return {
    title: `${getBlueprintProject(params.projectId)?.name ?? 'Blueprint project'} | Async Art`,
  };
}
export default function BlueprintProjectPage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams: { q?: string; page?: string };
}) {
  const project = getBlueprintProject(params.projectId);
  if (!project) notFound();
  const query =
    typeof searchParams.q === 'string' ? searchParams.q.slice(0, 300) : '';
  const page =
    typeof searchParams.page === 'string' ? Number(searchParams.page) : 1;
  const result = searchArchive(query, project.family, page, 'all', project.id);
  const pathname = `/archive/blueprints/project/${project.id}`;
  return (
    <main className="container mx-auto px-4 py-10 max-w-6xl">
      <Link
        className="text-accent underline text-sm"
        href={`/archive/${project.family}`}
      >
        Back to{' '}
        {project.family === 'music-blueprints'
          ? 'Music Blueprint'
          : 'Blueprint'}{' '}
        projects
      </Link>
      <h1 className="text-3xl sm:text-4xl font-bold mt-6 mb-3 break-words">
        {project.name}
      </h1>
      <p className="text-lg text-text-muted mb-3">
        {project.artists.join(', ')}
      </p>
      <p className="text-text-muted mb-6">
        {project.count.toLocaleString('en-US')} indexed editions in this
        project. This is the recovered inventory, not total minted supply. Each
        Blueprint edition is fixed once minted.
      </p>
      <form
        action={pathname}
        role="search"
        aria-label="Search this project's editions"
        className="flex flex-col sm:flex-row gap-4 items-end rounded-xl border border-border bg-surface-sunken p-5 mb-6"
      >
        <label className="block text-sm w-full">
          Search this project
          <input
            type="search"
            name="q"
            maxLength={300}
            defaultValue={query}
            placeholder="Edition title, token ID, or CID"
            className="block w-full mt-2 p-3 rounded-lg border border-border bg-surface-raised text-text-primary"
          />
        </label>
        <button type="submit" className="btn-primary whitespace-nowrap">
          Search editions
        </button>
      </form>
      {query && (
        <p className="mb-5">
          {result.total.toLocaleString('en-US')} matching editions{' '}
          <Link href={pathname} className="text-accent underline ml-3">
            Show all editions
          </Link>
        </p>
      )}
      {!result.total && <p>No editions match this search in this project.</p>}
      <ArchiveResults records={result.results} />
      <ArchivePagination
        pathname={pathname}
        params={{ q: query }}
        page={result.page}
        totalPages={result.totalPages}
      />
      <details className="mt-8 text-sm text-text-muted break-words">
        <summary className="cursor-pointer">Project information</summary>
        {project.evidence && (
          <p className="mt-2">
            {project.evidence.basis}{' '}
            <a
              href={project.evidence.evidenceUrl}
              className="text-accent underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Classification source
            </a>
          </p>
        )}
        <p className="mt-2">Blueprint ID: {project.id}</p>
        <p>
          {project.evidence
            ? 'Project name and category from the reviewed Music Blueprint catalog.'
            : project.nameSource === 'metadata'
              ? 'Project name from recovered collection metadata.'
              : 'Display name derived from edition titles; original project title may differ.'}{' '}
          Editions are grouped by the project ID reported in the recovery
          manifest.
        </p>
      </details>
    </main>
  );
}
