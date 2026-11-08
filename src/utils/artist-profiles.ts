import snapshot from '@/data/artist-profiles.json';
import { getArchiveRecords } from '@/utils/archive-search';
import { groupBlueprintProjects } from '@/utils/blueprint-projects';

export type ArtistProfile = (typeof snapshot.profiles)[number];
const normalize = (value: string) =>
  value.normalize('NFKC').trim().toLowerCase();
const searchText = (value: string) =>
  value.normalize('NFKD').replace(new RegExp('\\p{M}', 'gu'), '').toLowerCase();
const profiles = [...snapshot.profiles].sort((a, b) =>
  artistName(a).localeCompare(artistName(b), 'en'),
);
const byAddress = new Map(profiles.map((p) => [p.address, p]));
const aliases = new Map<string, Set<string>>();
for (const profile of profiles) {
  for (const alias of [profile.username, ...profile.aliases]) {
    if (!alias) continue;
    const key = normalize(alias);
    const addresses = aliases.get(key) ?? new Set<string>();
    addresses.add(profile.address);
    aliases.set(key, addresses);
  }
}
export function artistName(
  profile: Pick<ArtistProfile, 'name' | 'username' | 'address'>,
) {
  return (
    profile.name ||
    profile.username ||
    `${profile.address.slice(0, 8)}…${profile.address.slice(-6)}`
  );
}
export function getArtistProfile(value: string) {
  const key = normalize(value);
  const direct = byAddress.get(key);
  if (direct) return direct;
  const matches = aliases.get(key);
  return matches?.size === 1
    ? byAddress.get(Array.from(matches)[0])
    : undefined;
}
export function artistHref(profile: ArtistProfile) {
  const slug =
    profile.username && aliases.get(normalize(profile.username))?.size === 1
      ? profile.username
      : profile.address;
  return `/artists/${encodeURIComponent(slug)}`;
}
export function paginate<T>(items: T[], requestedPage = 1, size = 24) {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(
    Math.max(Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1, 1),
    totalPages,
  );
  return {
    items: items.slice((page - 1) * size, page * size),
    total: items.length,
    page,
    totalPages,
  };
}
export function browseArtists(query = '', page = 1) {
  const terms = searchText(query.slice(0, 300)).split(/\s+/).filter(Boolean);
  return paginate(
    profiles.filter((p) => {
      const text = searchText(
        [p.name, p.username, p.address, ...p.aliases].join(' '),
      );
      return terms.every((term) => text.includes(term));
    }),
    page,
  );
}
export const artistCount = profiles.length;
const records = getArchiveRecords();
const recordsById = new Map(records.map((r) => [r.id, r]));
const artistsByRecord = new Map<string, ArtistProfile[]>();
for (const profile of profiles) {
  for (const work of profile.works) {
    const list = artistsByRecord.get(work.recordId) ?? [];
    list.push(profile);
    artistsByRecord.set(work.recordId, list);
  }
}
export function artistsForRecord(id: string) {
  return artistsByRecord.get(id) ?? [];
}
export type ArtistWorkView = 'complete' | 'all';
export function artistWorks(
  profile: ArtistProfile,
  view: ArtistWorkView = 'all',
) {
  const linked = profile.works.flatMap((w) => {
    const record = recordsById.get(w.recordId);
    return record ? [{ record, basis: w.basis }] : [];
  });
  const projects = groupBlueprintProjects(linked.map((w) => w.record)).sort(
    (a, b) => a.name.localeCompare(b.name),
  );
  const projectIds = new Set(projects.map((p) => p.id));
  const artworks = linked
    .filter(
      ({ record }) =>
        !record.blueprintId || !projectIds.has(record.blueprintId),
    )
    .map(({ record }) => record)
    // The original catalog includes standalone classic works in its Master list.
    // Unknown records stay available in All works until their type is recovered.
    .filter(
      (record) =>
        view === 'all' || ['Master', 'Singleton'].includes(record.kind),
    )
    .sort(
      (a, b) =>
        Number(a.kind === 'Layer') - Number(b.kind === 'Layer') ||
        a.name.localeCompare(b.name, 'en', { numeric: true }),
    );
  return {
    projects,
    artworks,
    total: linked.length,
    nameAttributed: linked.some((w) => w.basis === 'archive-credit'),
  };
}
export function safeProfileUrl(
  value: string,
  kind: 'website' | 'twitter' | 'instagram' = 'website',
) {
  const input = value.trim();
  if (!input || /[\s\\\u0000-\u001f\u007f]/.test(input)) return null;
  if (
    input.startsWith('/') ||
    (/^[a-z][a-z0-9+.-]*:/i.test(input) && !/^https?:\/\//i.test(input))
  )
    return null;
  const host = kind === 'twitter' ? 'x.com' : 'instagram.com';
  const raw =
    kind !== 'website' && /^@?[a-zA-Z0-9_.]+$/.test(input)
      ? `https://${host}/${input.replace(/^@/, '')}`
      : /^https?:\/\//i.test(input)
        ? input
        : `https://${input}`;
  try {
    const url = new URL(raw);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      !url.hostname.includes('.')
    )
      return null;
    if (
      kind === 'twitter' &&
      !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(
        url.hostname,
      )
    )
      return null;
    if (
      kind === 'instagram' &&
      !['instagram.com', 'www.instagram.com'].includes(url.hostname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function captureDate(timestamp: string) {
  return `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`;
}
