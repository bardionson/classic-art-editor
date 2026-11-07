import { archiveFamilies } from '@/utils/archive-families';

export default function ArchiveSearchForm({
  query = '',
  family = 'all',
  id = 'archive-search',
}: {
  query?: string;
  family?: string;
  id?: string;
}) {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      aria-label="Search the Async archive"
      className="flex flex-col sm:flex-row gap-3"
    >
      <div className="flex-1">
        <label
          htmlFor={`${id}-query`}
          className="block text-sm font-medium mb-2"
        >
          Search the archive
        </label>
        <input
          id={`${id}-query`}
          type="search"
          name="q"
          defaultValue={query}
          maxLength={300}
          placeholder="Title, artist, token ID, contract, or CID"
          className="!h-12 !bg-surface-raised focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <div className="sm:w-52">
        <label
          htmlFor={`${id}-family`}
          className="block text-sm font-medium mb-2"
        >
          Collection
        </label>
        <select
          id={`${id}-family`}
          name="family"
          defaultValue={family}
          className="!h-12 !bg-surface-raised focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="all">All collections</option>
          {archiveFamilies.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
          <option value="unclassified">Under review</option>
        </select>
      </div>
      <button className="btn-primary sm:self-end h-12 px-6" type="submit">
        Search
      </button>
    </form>
  );
}
