import { describe, expect, it } from 'vitest';
import {
  bitcoinTransforms,
  ethBoyStep,
  HOUR,
  parseHourlyPrices,
  parseMarketPrice,
  type MarketPrice,
} from './artwork-market';
import original from './__fixtures__/artwork-market-original.json';

const now = Date.parse('2026-11-08T12:20:00Z');
const hour = Math.floor(now / 1000 / HOUR) * HOUR;
const candles = () =>
  Array.from({ length: 25 }, (_, i) => [
    hour - (25 - i) * HOUR,
    90,
    140,
    100,
    100 + i,
    2,
  ]);
const ticker = () => ({
  price: '126',
  time: new Date(now - 5000).toISOString(),
});
const price = (percent: number): MarketPrice => ({
  ...parseMarketPrice('ETH', ticker(), candles(), now),
  change24hPercent: percent,
});

describe('price inputs', () => {
  it('sorts 25 completed hourly closes and excludes the unfinished candle', () => {
    const rows = [...candles().reverse(), [hour, 90, 900, 100, 800, 1]];
    const result = parseHourlyPrices(rows, now);
    expect(result).toHaveLength(25);
    expect(result[0]).toEqual({
      closedAt: '2026-11-07T12:00:00.000Z',
      usd: 100,
    });
    expect(result[24]).toEqual({
      closedAt: '2026-11-08T12:00:00.000Z',
      usd: 124,
    });
    expect(
      parseMarketPrice('ETH', ticker(), rows, now).change24hPercent,
    ).toBeCloseTo(24);
  });
  it('rejects stale windows and gaps rather than inventing prices', () => {
    expect(() => parseHourlyPrices(candles().slice(1), now)).toThrow();
    expect(() => parseHourlyPrices(candles(), now + HOUR * 1000)).toThrow();
    const rows = candles();
    rows.splice(12, 1);
    expect(() => parseHourlyPrices(rows, now)).toThrow();
  });
  it.each([0, -1, NaN, Infinity])(
    'rejects invalid candle close %s',
    (value) => {
      const rows = candles();
      rows[5][4] = value;
      expect(() => parseHourlyPrices(rows, now)).toThrow();
    },
  );
  it('rejects conflicting duplicates', () => {
    const rows = candles();
    rows.push([...rows[0]]);
    rows[25][4] = 101;
    expect(() => parseHourlyPrices(rows, now)).toThrow();
  });
  it.each(['0', 'NaN', '-10', 'Infinity'])(
    'rejects invalid ticker %s',
    (value) => {
      expect(() =>
        parseMarketPrice('BTC', { ...ticker(), price: value }, candles(), now),
      ).toThrow();
    },
  );
  it('rejects stale/future timestamps', () => {
    for (const offset of [-601000, 61000])
      expect(() =>
        parseMarketPrice(
          'BTC',
          { ...ticker(), time: new Date(now + offset).toISOString() },
          candles(),
          now,
        ),
      ).toThrow();
  });
});

describe('ETH Boy recovered rules', () => {
  it.each([
    [0, 0, 0],
    [10, 208, -22],
    [10.01, 1040, -110],
    [-10, -208, 22],
    [-10.01, -1040, 110],
  ])('calculates %s percent steps', (change, bg, butterfly) => {
    const result = ethBoyStep(
      price(change),
      price(change),
      new Date(now),
      null,
    );
    expect(result.backgroundDelta).toBe(bg);
    expect(result.butterflyYDelta || 0).toBe(butterfly);
    expect(result.clothing).toBeNull();
  });
  it.each([
    [30, 'Very happy'],
    [20, 'Happy'],
    [10, 'Slightly happy'],
    [0, 'Neutral'],
    [-10, 'Slightly sad'],
    [-20, 'Slightly sad'],
    [-30, 'Sad'],
    [-31, 'Very sad'],
  ] as const)(
    'preserves first matching expression at %s percent',
    (change, face) => {
      expect(ethBoyStep(price(change), price(0), new Date(now), 100).face).toBe(
        face,
      );
    },
  );
  it('uses UTC birthdays and gas opacity limits', () => {
    expect(
      ethBoyStep(price(0), price(0), new Date('2026-01-30T20:00:00-05:00'), 0),
    ).toMatchObject({
      object: 'Birthday cake',
      clothing: { greenPercent: 100, redPercent: 0 },
    });
    expect(
      ethBoyStep(price(0), price(0), new Date('2026-07-30T12:00:00Z'), 300),
    ).toMatchObject({
      object: 'Baby (Ethereum launch anniversary)',
      clothing: { greenPercent: 0, redPercent: 100 },
    });
    expect(ethBoyStep(price(0), price(0), new Date(now), 100)).toMatchObject({
      object: 'None',
      clothing: { greenPercent: 0, redPercent: 0 },
    });
  });
});

describe('Bitcoin artwork transforms', () => {
  it.each(original.cases)(
    'matches the actual recovered script for $name',
    ({ prices, transforms }) => {
      const rows = bitcoinTransforms(
        prices.map((usd, i) => ({
          usd,
          closedAt: new Date(now + i * 3600000).toISOString(),
        })),
      );
      expect(rows).toHaveLength(24);
      expect(
        rows.flatMap(({ scale, rotation, x, y }) => [
          scale,
          rotation || 0,
          x,
          y,
        ]),
      ).toEqual(transforms);
    },
  );
  it('handles a flat market without NaN or displacement', () => {
    const rows = bitcoinTransforms(
      Array.from({ length: 25 }, () => ({ usd: 5204, closedAt: '' })),
    );
    expect(
      rows.every(
        (r) => r.scale === 100 && r.rotation === 0 && r.x === 0 && r.y === 0,
      ),
    ).toBe(true);
  });
  it('rejects incomplete histories', () =>
    expect(() => bitcoinTransforms([])).toThrow());
});
