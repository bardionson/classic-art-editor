import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { composeSupper, supperCore, supperItems } from './forever-supper';
import { getArchiveRecords } from './archive-search';
import { getExpansionMedia } from './dynamic-expansion-media';

describe('Forever Supper restoration', () => {
  it('uses only production Forever Supper items, with all records reachable', () => {
    const items = supperItems();
    expect(items).toHaveLength(1242);
    expect(new Set(items.map((i) => i.cid)).size).toBe(1242);
    expect(items.every((i) => i.coreAddress === supperCore.contract)).toBe(
      true,
    );
    expect(
      supperItems('Left Seat 1').every((i) =>
        getExpansionMedia(i.cid)?.layers.some((l) => l.slot === 'Left Seat 1'),
      ),
    ).toBe(true);
    expect(
      supperItems('', 'first supper forever').map((i) => i.name),
    ).toContain('First Supper Forever');
    expect(supperItems('', 'not-a-real-item-xyz')).toEqual([]);
  });
  it('preserves original layer order, base sources and blending from the captured application', () => {
    const original = JSON.parse(
      fs.readFileSync('public/archive/forever-supper/core-layout.json', 'utf8'),
    );
    const expected = original.layout.blueprintTypes[0].layers.map((l: any) => ({
      id: l.id,
      source: l.states[0].uri,
      label: l.states[0].label,
      blend: Object.keys(l.states[0].color ?? { normal: 1 })[0],
    }));
    expect(composeSupper([])).toEqual(expected);
    expect(expected).toHaveLength(32);
  });
  it('replaces the chosen slot while retaining base blending and other slots', () => {
    const item = supperItems('Back Right Screen')[0];
    const media = getExpansionMedia(item.cid)!;
    const output = composeSupper([item.cid]);
    const screen = output.find((l) => l.id === 'Back Right Screen')!;
    expect(screen.source).toBe(media.layers[0].source);
    expect(screen.blend).toBe('screen');
    expect(screen.source).not.toContain('/api/archive/image');
    expect(output.filter((l) => l.id !== screen.id)).toEqual(
      composeSupper([]).filter((l) => l.id !== screen.id),
    );
    expect(composeSupper([])).toEqual(supperCore.slots);
  });
  it('rejects foreign cores and conflicting slot choices instead of guessing', () => {
    const other = getArchiveRecords().find(
      (r) =>
        r.family === 'dynamic-blueprints' &&
        r.coreAddress !== supperCore.contract,
    )!;
    expect(() => composeSupper([other.cid])).toThrow(/another core/);
    const choices = supperItems('Left Seat 1');
    expect(() => composeSupper([choices[0].cid, choices[1].cid])).toThrow(
      /Conflicting/,
    );
    expect(composeSupper([choices[0].cid, choices[0].cid])).toEqual(
      composeSupper([choices[0].cid]),
    );
  });
});
