import { describe, expect, it } from 'vitest';
import {
  readControlValues,
  initialControlValues,
  changedControlValues,
  ownsControl,
} from './layer-controls';
import layers from '@/layers.json';
import provenance from '@/data/music-control-provenance.json';

const control = {
  minValue: 0,
  maxValue: 2,
  startValue: 0,
  label: 'Variant',
  controlType: 'STATE',
};
describe('collector layer controls', () => {
  it('opens on the current chain setting, preserving an explicit zero preview', () => {
    const current = readControlValues([BigInt(0), BigInt(2), BigInt(2)], 1);
    expect(initialControlValues(1593, [control], {}, current)).toEqual({
      0: 2,
    });
    expect(
      initialControlValues(1593, [control], { '1593-0': 0 }, current),
    ).toEqual({ 0: 0 });
    expect(
      initialControlValues(1593, [control], { '1593-0': 99 }, current),
    ).toEqual({ 0: 2 });
  });
  it('only submits changed levers and preserves signed controls', () => {
    const current = readControlValues(
      [BigInt(0), BigInt(2), BigInt(2), -BigInt(100), BigInt(100), BigInt(0)],
      2,
    );
    expect(changedControlValues({ 0: 2, 1: -20 }, current)).toEqual({
      leverIds: [BigInt(1)],
      values: [-BigInt(20)],
    });
    expect(changedControlValues({ 0: 2, 1: 0 }, current).leverIds).toEqual([]);
    for (const value of [101, NaN, 0.5])
      expect(() => changedControlValues({ 1: value }, current)).toThrow();
    expect(() => changedControlValues({ 2: 1 }, current)).toThrow();
  });
  it('rejects missing or invalid chain state instead of enabling a guessed save', () => {
    expect(() => readControlValues([], 1)).toThrow();
    expect(() =>
      readControlValues([BigInt(0), BigInt(2), BigInt(3)], 1),
    ).toThrow();
    expect(() =>
      readControlValues(
        [BigInt(0), BigInt('1152921504606846976'), BigInt(0)],
        1,
      ),
    ).toThrow();
  });
  it('compares wallet addresses without case sensitivity and denies disconnected users', () => {
    expect(ownsControl('0xAbC', '0xabc')).toBe(true);
    expect(ownsControl(undefined, '0xabc')).toBe(false);
    expect(ownsControl('0xdef', '0xabc')).toBe(false);
  });
  it('restores Betty’s four original named stem controls', () => {
    const data = Object.values(layers).flat();
    const betty = data.filter((l) =>
      [1593, 1594, 1595, 1596].includes(Number(l.tokenId)),
    );
    expect(betty).toHaveLength(4);
    expect(betty.map((l) => l.name)).toEqual([
      'The Choir',
      "Betty's Voice",
      "Betty's Choir",
      "Betty's Radio",
    ]);
    expect(betty[0].controls[0].stateLabels).toEqual([
      'Studio',
      'Concert Hall',
      'Directional',
    ]);
    expect(
      betty.every(
        (l) =>
          l.masterTokenId === 'QmY9dfJHH8Q5S2uLbKVspY4rFNCvUdxmnnSQG7q1vWWfGs',
      ),
    ).toBe(true);
  });
  it('indexes every recovered control exactly once with complete state choices', () => {
    const data = Object.values(layers).flat();
    expect(provenance).toHaveLength(85);
    for (const entry of provenance) {
      const matches = data.filter((l) => Number(l.tokenId) === entry.tokenId);
      expect(matches).toHaveLength(1);
      for (const c of matches[0].controls) {
        expect(c.stateLabels).toHaveLength(
          Number(c.maxValue) - Number(c.minValue) + 1,
        );
      }
    }
  });
});
