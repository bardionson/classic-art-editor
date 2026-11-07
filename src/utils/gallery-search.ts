import type { GalleryItem } from '@/components/gallery/Gallery';

const combiningMarks = new RegExp('\\p{M}', 'gu');

function normalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(combiningMarks, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Numeric queries are token lookups, not substring matches against dates in
// descriptions. Keep the contract version when an artwork URL is supplied.
export function gallerySearchScore(item: GalleryItem, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const route = q.match(
    /^(?:https?:\/\/(?:www\.)?async\.art)?\/(v[12])\/(\d+)(?:[?#].*)?$/,
  );
  const numeric = q.match(/^#?(\d+)$/);
  if (route || numeric) {
    const token = (route?.[2] ?? numeric![1]).replace(/^0+(?=\d)/, '');
    const sameVersion = !route || item.link.startsWith('/' + route[1] + '/');
    return token === item.tokenId && sameVersion ? 100 : -1;
  }
  if (/^0x[0-9a-f]{40}$/.test(q)) {
    return item.contractAddress?.toLowerCase() === q ? 100 : -1;
  }
  const name = normalize(item.name);
  const artist = normalize(item.artistName || '');
  const description = normalize(item.description || '');
  if (name === q) return 90;
  if (artist === q) return 85;
  if (name.includes(q)) return 70;
  if (artist.includes(q)) return 65;
  const terms = q.split(' ');
  const identity = name + ' ' + artist;
  if (terms.every((term) => identity.includes(term))) return 50;
  const all = identity + ' ' + description;
  return terms.every((term) => all.includes(term)) ? 10 : -1;
}
