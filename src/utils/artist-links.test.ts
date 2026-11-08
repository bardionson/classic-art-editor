import { describe, it, expect } from 'vitest';
import identities from '@/data/artist-link-index.json';
import { artistHref, getArtistProfile } from './artist-profiles';
import {
  artistCreditParts,
  buildArtistLinks,
  findArtistLink,
} from './artist-links';
describe('artist name links', () => {
  it('links exact names, handles and wallets to real restored profile routes', () => {
    expect(findArtistLink('Bard IONSON')?.href).toBe('/artists/bardionson');
    expect(findArtistLink('BÃ¥rd Ionson')?.href).toBe('/artists/bardionson');
    expect(findArtistLink('H. Eissa')?.href).toBe(
      findArtistLink('Hussam Eissa')?.href,
    );
    expect(findArtistLink('bardionson')?.href).toBe('/artists/bardionson');
    for (const entry of identities) {
      expect(entry.href).toBe(artistHref(getArtistProfile(entry.address)!));
      expect(findArtistLink(entry.address.toUpperCase())?.href).toBe(
        entry.href,
      );
    }
  });
  it('keeps collaboration text intact and gives each known artist their own link', () => {
    const credit = 'Bard IONSON, Coldie & Unrecovered Artist';
    const parts = artistCreditParts(credit);
    expect(parts.map((p) => p.text).join('')).toBe(credit);
    expect(parts.filter((p) => p.href).map((p) => p.href)).toEqual([
      '/artists/bardionson',
      '/artists/coldie',
    ]);
    expect(
      parts.find((p) => p.text === 'Unrecovered Artist')?.href,
    ).toBeUndefined();
    const allowed = [findArtistLink('Coldie')!.address];
    expect(
      artistCreditParts(credit, allowed)
        .filter((p) => p.href)
        .map((p) => p.href),
    ).toEqual(['/artists/coldie']);
  });
  it('does not invent profiles from fuzzy or ambiguous matches', () => {
    expect(findArtistLink('bardion')).toBeUndefined();
    expect(findArtistLink('Bard IONSON Studios')).toBeUndefined();
    const lookup = buildArtistLinks([
      { address: 'a', href: '/artists/a', names: ['Same'] },
      { address: 'b', href: '/artists/b', names: ['same'] },
    ]);
    expect(lookup('Same')).toBeUndefined();
    expect(lookup('a')?.href).toBe('/artists/a');
    const accents = buildArtistLinks([
      { address: 'a', href: '/artists/a', names: ['José'] },
      { address: 'b', href: '/artists/b', names: ['Jose'] },
    ]);
    expect(accents('Jose')).toBeUndefined();
  });
});
