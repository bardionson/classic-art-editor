import { archiveFamilies } from '@/utils/archive-families';
import { displayStatuses } from '@/utils/archive-search';

export default function ArchiveSearchForm({
  query = '',
  family = 'all',
  status = 'all',
  id = 'archive-search',
}: {
  query?: string;
  family?: string;
  status?: string;
  id?: string;
}) {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      aria-label="Search the Async archive"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(180px,1fr)_180px_220px_auto]"
    >
      <div className="sm:col-span-2 lg:col-span-1">
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
          placeholder="Title, artist, token, contract, or CID"
          className="!h-12 !bg-surface-raised focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <div>
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
          className="!h-12 !bg-surface-raised"
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
      <div>
        <label
          htmlFor={`${id}-status`}
          className="block text-sm font-medium mb-2"
        >
          Restoration stage
        </label>
        <select
          id={`${id}-status`}
          name="status"
          defaultValue={status}
          className="!h-12 !bg-surface-raised"
        >
          <option value="all">All stages</option>
          {displayStatuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <button className="btn-primary self-end h-12 px-6" type="submit">
        Search
      </button>
    </form>
  );
}
