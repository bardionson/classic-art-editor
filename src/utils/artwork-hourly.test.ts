import { describe, expect, it } from 'vitest';
import {
  bitcoinOverrides,
  CLASSIC_V1,
  CLASSIC_V2,
  ethOverrides,
  HOUR_MS,
  priceArtworkId,
  renderingOverrides,
} from './artwork-hourly';
import { MarketPrice } from './artwork-market';
export function price(
  symbol: 'ETH' | 'BTC',
  hour: number,
  change = 1,
): MarketPrice {
  const hourly = Array.from({ length: 25 }, (_, i) => ({
    closedAt: new Date(hour - (24 - i) * HOUR_MS).toISOString(),
    usd: 100 + (i * change) / 24,
  }));
  return {
    symbol,
    hourly,
    usd: hourly[24].usd,
    tradedAt: new Date(hour).toISOString(),
    change24hPercent: change,
  };
}
const hour = Date.parse('2026-11-08T12:00:00Z');
describe('price controls for rendering', () => {
  it('only enables the intended contracts and masters, never hidden #115', () => {
    expect(priceArtworkId(CLASSIC_V2, 807)).toBe(807);
    expect(priceArtworkId(CLASSIC_V2, 245)).toBe(245);
    expect(priceArtworkId(CLASSIC_V1, 245)).toBe(245);
    expect(priceArtworkId(CLASSIC_V1, 807)).toBeNull();
    expect(priceArtworkId(CLASSIC_V2, 115)).toBeNull();
    expect(priceArtworkId('0xother', 245)).toBeNull();
  });
  it('maps all 24 Bitcoin transforms to 246 and preserves styling and milestones', () => {
    const result = bitcoinOverrides(price('BTC', hour, 0));
    expect(Object.keys(result)).toHaveLength(96);
    for (let i = 0; i < 24; i++) {
      expect(result[`246-${4 * i}`]).toBe(100);
      expect(result[`246-${4 * i + 1}`]).toBe(0);
      expect(result[`246-${4 * i + 2}`]).toBe(0);
      expect(result[`246-${4 * i + 3}`]).toBe(0);
    }
    expect(result['247-0']).toBeUndefined();
    expect(result['246-96']).toBeUndefined();
  });
  it('clamps both ETH Boy positions and leaves non-price levers untouched', () => {
    const result = ethOverrides(
      10400,
      -1070,
      price('ETH', hour, 11),
      price('BTC', hour, 11),
      hour,
      null,
    );
    expect(result).toEqual({
      '808-0': 10420,
      '808-3': 2,
      '808-4': 2,
      '808-8': -1080,
    });
    const down = ethOverrides(
      -10400,
      1070,
      price('ETH', hour, -11),
      price('BTC', hour, -11),
      hour,
      150.2,
    );
    expect(down).toMatchObject({
      '808-0': -10420,
      '808-8': 1080,
      '808-1': 0,
      '808-2': 50,
    });
  });
  it('uses UTC anniversaries and integer gas controls', () => {
    const birthday = Date.parse('2026-01-31T00:00:00Z');
    expect(
      ethOverrides(
        0,
        0,
        price('ETH', birthday),
        price('BTC', birthday),
        birthday,
        4.3,
      ),
    ).toMatchObject({ '808-4': 1, '808-1': 96, '808-2': 0 });
    const launch = Date.parse('2026-07-30T00:00:00Z');
    expect(
      ethOverrides(
        0,
        0,
        price('ETH', launch),
        price('BTC', launch),
        launch,
        null,
      )['808-4'],
    ).toBe(0);
  });
  it('local previews take precedence without mutating wallet form values', () => {
    const local = Object.freeze({ '246-0': 250, '247-0': 3 });
    const automated = Object.freeze({ '246-0': 100, '246-1': 20 });
    expect(renderingOverrides(automated, local)).toEqual({
      '246-0': 250,
      '246-1': 20,
      '247-0': 3,
    });
    expect(local).toEqual({ '246-0': 250, '247-0': 3 });
  });
});
