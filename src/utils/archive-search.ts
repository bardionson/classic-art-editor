import snapshot from '@/data/archive-index.json';
import { ipfsPath } from '@/utils/archive-media';

export interface ArchiveRecord {
  id: string;
  name: string;
  artist: string;
  description: string;
  family: string;
  kind: string;
  tokenId: string;
  contractAddress: string;
  coreAddress?: string;
  cid: string;
  link: string | null;
  source: string;
  identityStatus: string;
  metadataVerified: boolean;
  metadataLocal?: boolean;
  slot?: string;
  image?: string;
  imageSource?: string;
  collection?: string;
  blueprintId?: string;
}
export const displayStatuses = [
  { id: 'artwork', label: 'Artwork page available' },
  { id: 'preview', label: 'Preview indexed · viewer pending' },
  { id: 'metadata', label: 'Metadata indexed · preview on demand' },
] as const;
export function displayStatus(record: ArchiveRecord) {
  return record.link ? 'artwork' : record.image ? 'preview' : 'metadata';
}
export function displayStatusLabel(status: string) {
  return displayStatuses.find((s) => s.id === status)?.label ?? '';
}
const normalize = (text: string) =>
  text
    .normalize('NFKD')
    .replace(new RegExp('\\p{M}', 'gu'), '')
    .toLowerCase()
    .replace(new RegExp('[^\\p{L}\\p{N}]+', 'gu'), ' ')
    .trim()
    .replace(/\s+/g, ' ');
const records = snapshot.records as ArchiveRecord[];
const byCid = new Map(records.filter((r) => r.cid).map((r) => [r.cid, r]));
export function getBlueprintRecords() {
  return records.filter((r) => r.family === 'blueprints');
}
export function getArchiveRecordByCid(cid: string) {
  return byCid.get(cid);
}
const prepared = records.map((record) => ({
  record,
  name: normalize(record.name),
  artist: normalize(record.artist),
  text: normalize(
    [
      record.name,
      record.artist,
      record.description,
      record.collection,
      record.slot,
      record.blueprintId,
    ].join(' '),
  ),
  imageCid: record.image ? ipfsPath(record.image)?.split('/')[0] : undefined,
}));
const contracts = {
  v1: '0x6c424c25e9f1fff9642cb5b7750b0db7312c29ad',
  v2: '0xb6dae651468e9593e4581705a09c10a76ac1e0c8',
};
export const archiveCoverage = {
  total: records.length,
  counts: snapshot.counts,
  generatedOn: snapshot.generatedOn,
};

export function searchArchive(
  query: string,
  family = 'all',
  page = 1,
  status = 'all',
  blueprintId?: string,
) {
  const raw = query.trim().slice(0, 300);
  const q = normalize(raw);
  const lower = raw.toLowerCase();
  const route = lower.match(
    /^(?:https?:\/\/(?:www\.)?async\.art)?\/(v[12])\/(\d+)\/?(?:[?#].*)?$/,
  );
  const layerRoute = lower.match(
    /^(?:https?:\/\/(?:www\.)?async\.art)?\/layer\/(0x[0-9a-f]{40})\/(\d+)\/?(?:[?#].*)?$/,
  );
  const qualified = lower.match(/^(0x[0-9a-f]{40})[:/](\d+)\/?$/);
  const token =
    route?.[2] ??
    layerRoute?.[2] ??
    qualified?.[2] ??
    lower.match(/^#?(\d+)$/)?.[1];
  const canonicalToken = token?.replace(/^0+(?=\d)/, '');
  const contract = route
    ? contracts[route[1] as keyof typeof contracts]
    : (layerRoute?.[1] ?? qualified?.[1]);
  const isAddress = /^0x[0-9a-f]{40}$/.test(lower);
  // Treat identifier-shaped queries as exact identifiers, including malformed case,
  // so CIDv0 can never accidentally fall through to case-insensitive text search.
  const cid =
    raw.match(
      /(?:^|\/)((?:[Qq][Mm][a-zA-Z0-9]{44}|b[a-z2-7]{20,}))(?:$|[/?#])/,
    )?.[1] ?? ipfsPath(raw)?.split('/')[0];
  const terms = q.split(' ').filter(Boolean);
  const hits = prepared.flatMap(({ record, name, artist, text, imageCid }) => {
    let score = 0;
    if (cid) {
      if (record.cid !== cid && imageCid !== cid) return [];
      score = record.cid === cid ? 120 : 115;
    } else if (canonicalToken !== undefined) {
      if (
        record.tokenId !== canonicalToken ||
        (contract && record.contractAddress.toLowerCase() !== contract)
      )
        return [];
      score = 110;
    } else if (isAddress) {
      if (
        record.contractAddress.toLowerCase() !== lower &&
        record.coreAddress?.toLowerCase() !== lower
      )
        return [];
      score = 100;
    } else if (q) {
      if (name === q) score = 90;
      else if (artist === q) score = 85;
      else if (name.includes(q)) score = 70;
      else if (artist.includes(q)) score = 65;
      else if (terms.every((term) => (name + ' ' + artist).includes(term)))
        score = 50;
      else if (terms.every((term) => text.includes(term))) score = 10;
      else return [];
    }
    return [{ record, score }];
  });
  const familyCounts: Record<string, number> = {};
  for (const { record } of hits)
    familyCounts[record.family] = (familyCounts[record.family] ?? 0) + 1;
  const filtered = hits.filter(
    ({ record }) =>
      (!blueprintId || record.blueprintId === blueprintId) &&
      (family === 'all' || record.family === family) &&
      (status === 'all' || displayStatus(record) === status),
  );
  filtered.sort(
    (a, b) =>
      b.score - a.score ||
      a.record.name.localeCompare(b.record.name, 'en', { numeric: true }) ||
      a.record.id.localeCompare(b.record.id),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 24));
  const currentPage = Math.min(
    Math.max(Number.isFinite(page) ? Math.floor(page) : 1, 1),
    totalPages,
  );
  return {
    results: filtered
      .slice((currentPage - 1) * 24, currentPage * 24)
      .map((h) => h.record),
    total: filtered.length,
    totalPages,
    page: currentPage,
    familyCounts,
  };
}
