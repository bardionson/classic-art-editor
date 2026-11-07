import { describe, expect, it } from 'vitest';
import { gallerySearchScore } from './gallery-search';
import { getMastersGalleryItems } from './masters';
import type { GalleryItem } from '@/components/gallery/Gallery';

describe('gallery search against the real master catalog', () => {
  const items = getMastersGalleryItems();
  it.each(['538', '#538', ' 00538 '])(
    'finds Mind Puzzle for %s without date/title substring false positives',
    (query) => {
      expect(
        items
          .filter((item) => gallerySearchScore(item, query) >= 0)
          .map((item) => item.tokenId),
      ).toEqual(['538']);
    },
  );
  it.each(['800', 'https://www.async.art/v2/800?referrer=masters'])(
    'finds the restoration priority using %s',
    (query) => {
      const results = items.filter(
        (item) => gallerySearchScore(item, query) >= 0,
      );
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('The World is Confusing');
    },
  );
  it('does not confuse V1 and V2 URLs with the same token number', () => {
    const item = items.find((item) => item.tokenId === '800')!;
    expect(gallerySearchScore(item, '/v1/800')).toBe(-1);
  });
});

describe('text relevance', () => {
  const item: GalleryItem = {
    id: 'one',
    tokenId: '1',
    name: 'Mind Puzzle',
    artistName: 'Bård Ionson',
    description: 'A world of experiences',
    imageUrl: '',
    link: '/v2/1',
  };
  it('normalizes accents, spacing, and case in artist queries', () => {
    expect(gallerySearchScore(item, ' BARD   IONSON ')).toBe(85);
  });
  it('ranks a title match above a description mention', () => {
    const mention = {
      ...item,
      name: 'Other',
      description: 'Inspired by Mind Puzzle',
    };
    expect(gallerySearchScore(item, 'mind puzzle')).toBeGreaterThan(
      gallerySearchScore(mention, 'mind puzzle'),
    );
  });
  it('requires every query word and accepts a blank query', () => {
    expect(gallerySearchScore(item, 'puzzle bard')).toBe(50);
    expect(gallerySearchScore(item, 'puzzle nonexistent')).toBe(-1);
    expect(gallerySearchScore(item, '  ')).toBe(0);
  });
});
