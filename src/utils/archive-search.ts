import snapshot from '@/data/archive-index.json';

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
}
const normalize = (text: string) =>
  text
    .normalize('NFKD')
    .replace(new RegExp('\\p{M}', 'gu'), '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
const records = snapshot.records as ArchiveRecord[];
const prepared = records.map((record) => ({
  record,
  name: normalize(record.name),
  artist: normalize(record.artist),
  text: normalize(
    [
      record.name,
      record.artist,
      record.description,
      record.tokenId,
      record.contractAddress,
      record.coreAddress,
      record.cid,
    ].join(' '),
  ),
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

export function searchArchive(query: string, family = 'all', page = 1) {
  const raw = query.trim().slice(0, 300);
  const q = normalize(raw);
  const route = q.match(
    /^(?:https?:\/\/(?:www\.)?async\.art)?\/(v[12])\/(\d+)(?:[?#].*)?$/,
  );
  const qualified = q.match(/^(0x[0-9a-f]{40})[:/](\d+)$/);
  const token = route?.[2] ?? qualified?.[2] ?? q.match(/^#?(\d+)$/)?.[1];
  const canonicalToken = token?.replace(/^0+(?=\d)/, '');
  const contract = route
    ? contracts[route[1] as keyof typeof contracts]
    : qualified?.[1];
  const isAddress = /^0x[0-9a-f]{40}$/.test(q);
  // CIDv0 is case-sensitive. Never normalize a content identifier into a false match.
  const cid = raw.match(/(?:^|\/)(Qm[1-9A-HJ-NP-Za-km-z]{44})(?:$|[/?#])/)?.[1];
  const terms = q.split(' ');
  const hits = prepared.flatMap(({ record, name, artist, text }) => {
    if (family !== 'all' && record.family !== family) return [];
    let score = 0;
    if (cid) {
      if (record.cid !== cid) return [];
      score = 120;
    } else if (canonicalToken !== undefined) {
      if (
        record.tokenId !== canonicalToken ||
        (contract && record.contractAddress.toLowerCase() !== contract)
      )
        return [];
      score = 110;
    } else if (isAddress) {
      if (
        record.contractAddress.toLowerCase() !== q &&
        record.coreAddress?.toLowerCase() !== q
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
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      a.record.name.localeCompare(b.record.name) ||
      a.record.id.localeCompare(b.record.id),
  );
  const totalPages = Math.max(1, Math.ceil(hits.length / 24));
  const currentPage = Math.min(
    Math.max(Number.isFinite(page) ? Math.floor(page) : 1, 1),
    totalPages,
  );
  return {
    results: hits
      .slice((currentPage - 1) * 24, currentPage * 24)
      .map((h) => h.record),
    total: hits.length,
    totalPages,
    page: currentPage,
  };
}
