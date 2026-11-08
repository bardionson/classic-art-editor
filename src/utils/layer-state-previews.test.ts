import { describe, expect, it } from 'vitest';
import { getLayerStatePreviews } from './layer-state-previews';

// Original Betty metadata: the control names Stem_Mix_0, but its preview
// artwork comes from NotebookAndRadioBG, not the mix-indicator overlay.
const art = [
  'Qmc456Mnpqtrgr7vE371XCyUusJkQACbnxp9xo8nqAA8qP',
  'Qmb2W7gYMQ8G51tJDoj7JA5ommgDrjBY42QAEWGJQK46Nf',
  'QmPAtRnwX3cDgGjrrJadvaksQxjBwykqhHfd4NR4CiTa1A',
];
const indicator = 'QmZkPkUKV96syd6XeFXWqnDMDDTYewozvFyGzmEn2d9c9g';
const layout = [
  {
    id: 'Stem_Mix_0',
    states: { 'token-id': 1, 'lever-id': 0, options: [{ uri: indicator }] },
  },
  {
    id: 'NotebookAndRadioBG',
    states: {
      'token-id': 1,
      'lever-id': 0,
      options: art.map((uri) => ({ uri })),
    },
  },
];
describe('layer variant previews', () => {
  it('recovers all three original Choir art variants instead of the mix indicator', () => {
    expect(
      getLayerStatePreviews(layout, 1592, 1593, 0, 'Stem_Mix_0 (STATE)', true),
    ).toEqual(art);
  });
  it('matches both relative token and lever; never substitutes another collector’s art', () => {
    expect(
      getLayerStatePreviews(layout, 1592, 1594, 0, 'Stem_Mix_0 (STATE)', true),
    ).toEqual([]);
    expect(
      getLayerStatePreviews(layout, 1592, 1593, 1, 'Stem_Mix_0 (STATE)', true),
    ).toEqual([]);
  });
  it('uses the named visual control for classic art and preserves missing option positions', () => {
    expect(
      getLayerStatePreviews(layout, 1592, 1593, 0, 'Stem_Mix_0 (STATE)', false),
    ).toEqual([indicator]);
    const missing = [
      {
        states: {
          'token-id': 1,
          'lever-id': 0,
          options: [{}, { uri: art[1] }],
        },
      },
    ];
    expect(getLayerStatePreviews(missing, 1592, 1593, 0, '', false)).toEqual([
      null,
      art[1],
    ]);
    expect(getLayerStatePreviews(layout, undefined, 1593, 0, '', true)).toEqual(
      [],
    );
  });
});
