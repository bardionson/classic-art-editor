import identities from '@/data/artist-link-index.json';
export type ArtistLinkIdentity = {
  address: string;
  href: string;
  names: string[];
};
const normalize = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
export function buildArtistLinks(entries: ArtistLinkIdentity[]) {
  const matches = new Map<string, Map<string, ArtistLinkIdentity>>();
  for (const entry of entries) {
    for (const name of [entry.address, ...entry.names]) {
      const key = normalize(name);
      if (!key) continue;
      const choices = matches.get(key) ?? new Map();
      choices.set(entry.address, entry);
      matches.set(key, choices);
    }
  }
  return (name: string) => {
    const choices = matches.get(normalize(name));
    return choices?.size === 1 ? Array.from(choices.values())[0] : undefined;
  };
}
export const findArtistLink = buildArtistLinks(identities);
export function artistCreditParts(credit: string, allowedAddresses?: string[]) {
  const resolve = (text: string) => {
    const artist = findArtistLink(text);
    return artist &&
      (!allowedAddresses?.length || allowedAddresses.includes(artist.address))
      ? artist
      : undefined;
  };
  // Resolve complete names first: an artist's name may itself contain a comma
  // or ampersand. Never fuzzy-match or link an entire collaboration to one artist.
  const whole = resolve(credit);
  if (whole) return [{ text: credit, href: whole.href }];
  return credit
    .split(/(\s*[,;&+×]\s*|\s+(?:and|x|with|feat\.?)\s+)/i)
    .filter(Boolean)
    .map((text) => ({ text, href: resolve(text)?.href }));
}
