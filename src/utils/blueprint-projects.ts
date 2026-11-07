import {
  getBlueprintRecords,
  type ArchiveRecord,
} from '@/utils/archive-search';

const text = (value: string) =>
  value
    .normalize('NFKD')
    .replace(new RegExp('\\p{M}', 'gu'), '')
    .toLowerCase()
    .trim();
function mostCommon(values: string[]) {
  const counts = new Map<string, { label: string; count: number }>();
  for (const value of values.filter(Boolean)) {
    const key = text(value);
    const row = counts.get(key) ?? { label: value.trim(), count: 0 };
    row.count++;
    counts.set(key, row);
  }
  return Array.from(counts.values()).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  )[0]?.label;
}
export function groupBlueprintProjects(records: ArchiveRecord[]) {
  const groups = new Map<string, ArchiveRecord[]>();
  for (const record of records) {
    if (record.family !== 'blueprints' || !record.blueprintId) continue;
    const group = groups.get(record.blueprintId) ?? [];
    group.push(record);
    groups.set(record.blueprintId, group);
  }
  return Array.from(groups).map(([id, editions]) => {
    const ordered = [...editions].sort(
      (a, b) =>
        a.name.localeCompare(b.name, 'en', { numeric: true }) ||
        a.id.localeCompare(b.id),
    );
    const collection = mostCommon(editions.map((r) => r.collection ?? ''));
    const name =
      collection ??
      mostCommon(
        editions.map((r) => r.name.replace(/\s*#\s*\d+\s*$/, '').trim()),
      ) ??
      `Blueprint ${id}`;
    const artists = Array.from(
      new Map(
        ordered.filter((r) => r.artist).map((r) => [text(r.artist), r.artist]),
      ).values(),
    );
    return {
      id,
      name,
      artists,
      count: editions.length,
      nameSource: collection ? 'metadata' : ('edition' as string),
      cover: ordered.find((r) => r.image) ?? ordered[0],
      searchText: text(
        [name, id, ...artists, ...editions.map((r) => r.name)].join(' '),
      ),
    };
  });
}
const projects = groupBlueprintProjects(getBlueprintRecords());
export function getBlueprintProject(id: string) {
  return projects.find((p) => p.id === id);
}
export function browseBlueprintProjects(
  query = '',
  sort = 'largest',
  page = 1,
) {
  const terms = text(query.slice(0, 300)).split(/\s+/).filter(Boolean);
  const matches = projects.filter((p) =>
    terms.every((term) => p.searchText.includes(term)),
  );
  matches.sort(
    (a, b) =>
      (sort === 'name' ? 0 : b.count - a.count) ||
      a.name.localeCompare(b.name, 'en', { numeric: true }) ||
      a.id.localeCompare(b.id),
  );
  const totalPages = Math.max(1, Math.ceil(matches.length / 24));
  const currentPage = Math.min(
    Math.max(Number.isFinite(page) ? Math.floor(page) : 1, 1),
    totalPages,
  );
  return {
    projects: matches.slice((currentPage - 1) * 24, currentPage * 24),
    total: matches.length,
    allProjects: projects.length,
    editions: projects.reduce((sum, p) => sum + p.count, 0),
    page: currentPage,
    totalPages,
  };
}
