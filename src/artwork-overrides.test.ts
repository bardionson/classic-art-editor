import { describe, it, expect } from 'vitest';
import artworkOverrides from './artwork-overrides.json';

describe('artwork-overrides.json', () => {
  it('maps the 3 known broken-composite tokens to their working slugs', () => {
    expect(artworkOverrides).toEqual({
      '805': 'the-gate',
      '616': 'android-dorian-grey',
      '1524': 'tarot',
    });
  });
});
