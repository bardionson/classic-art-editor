import { describe, expect, it, vi } from 'vitest';
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('./r2-audio', () => ({ audioStorageConnection: vi.fn() }));
import fixture from './__fixtures__/bitcoin-milestones-original.json';
import {
  bitcoinMilestoneChanges,
  BitcoinCheckpoint,
} from './bitcoin-milestones';
import {
  restoreBitcoin,
  validateBitcoinCheckpoint,
} from './artwork-hourly-server';
import { CLASSIC_V1, HOUR_MS } from './artwork-hourly';
import { MarketPrice } from './artwork-market';
const target = Date.parse('2026-11-08T12:00:00Z');
function price(first: number, last: number, hour = target): MarketPrice {
  return {
    symbol: 'BTC',
    usd: last,
    tradedAt: new Date(hour).toISOString(),
    change24hPercent: (last / first - 1) * 100,
    hourly: Array.from({ length: 25 }, (_, i) => ({
      usd: first + ((last - first) * i) / 24,
      closedAt: new Date(hour - (24 - i) * HOUR_MS).toISOString(),
    })),
  };
}
function deps() {
  return {
    load: vi
      .fn<() => Promise<{ state: BitcoinCheckpoint; etag: string } | null>>()
      .mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    anchor: vi.fn().mockResolvedValue({
      contract: CLASSIC_V1,
      block: '123',
      observedAt: new Date(target).toISOString(),
      milestones: {
        '246-96': 17,
        '246-97': 13,
        '246-98': 13,
        '246-99': 13,
        '246-100': 13,
        '246-101': 13,
      },
    }),
    windows: vi.fn(
      async (_symbol: 'BTC' | 'ETH', first: number, last: number) =>
        Array.from({ length: (last - first) / HOUR_MS + 1 }, (_, i) =>
          price(98900, 99000, first + i * HOUR_MS),
        ),
    ),
  };
}
describe('original milestone parity', () => {
  for (const sample of fixture.cases)
    it(sample.name, () => {
      expect(
        bitcoinMilestoneChanges(
          sample.prices.map((usd, i) => ({
            usd,
            closedAt: new Date(target - (24 - i) * HOUR_MS).toISOString(),
          })),
        ),
      ).toEqual(sample.changes);
    });
  it('rejects an unrepresentable sixth glyph instead of changing another control', () => {
    expect(() =>
      bitcoinMilestoneChanges(price(999400000, 999600000).hourly),
    ).toThrow('five-character');
  });
  it('rejects invalid prices', () => {
    expect(() => bitcoinMilestoneChanges(price(NaN, 90000).hourly)).toThrow();
    expect(() => bitcoinMilestoneChanges([])).toThrow();
  });
});
describe('persistent Bitcoin milestones', () => {
  it('anchors six controls, publishes 102 price controls and preserves artist styling', async () => {
    const d = deps(),
      result = await restoreBitcoin(target, d);
    expect(validateBitcoinCheckpoint(result)).toBe(result);
    expect(Object.keys(result.overrides)).toHaveLength(102);
    expect(
      Object.keys(result.overrides).every((k) => k.startsWith('246-')),
    ).toBe(true);
    expect(result.overrides).toMatchObject({
      '246-96': 17,
      '246-97': 13,
      '246-98': 0,
      '246-99': 10,
      '246-100': 10,
      '246-101': 11,
    });
    expect(d.save).toHaveBeenCalledWith(result, undefined);
  });
  it('same-hour reads do not recalculate or write', async () => {
    const prior = await restoreBitcoin(target, deps()),
      d = deps();
    d.load.mockResolvedValue({ state: prior, etag: 'v1' });
    expect(await restoreBitcoin(target, d)).toBe(prior);
    expect(d.windows).not.toHaveBeenCalled();
    expect(d.save).not.toHaveBeenCalled();
  });
  it('replays crossings and retains both the new badge and older digits in a declining hour', async () => {
    const prior = await restoreBitcoin(target - 2 * HOUR_MS, deps()),
      d = deps();
    d.load.mockResolvedValue({ state: prior, etag: 'v1' });
    d.windows.mockResolvedValue([
      price(99999, 100000, target - HOUR_MS),
      price(100000, 99900, target),
    ]);
    const result = await restoreBitcoin(target, d);
    expect(result.overrides['246-96']).toBe(6);
    for (let i = 97; i <= 101; i++)
      expect(result.overrides['246-' + i]).toBe(prior.overrides['246-' + i]);
    expect(d.save).toHaveBeenCalledWith(result, 'v1');
    expect(d.anchor).not.toHaveBeenCalled();
  });
  it('clears graphics on a gain without a crossing', async () => {
    const prior = await restoreBitcoin(target - HOUR_MS, deps()),
      d = deps();
    d.load.mockResolvedValue({ state: prior, etag: 'v1' });
    d.windows.mockResolvedValue([price(100001, 100002)]);
    const result = await restoreBitcoin(target, d);
    expect(result.overrides['246-96']).toBe(17);
    for (let i = 97; i <= 101; i++)
      expect(result.overrides['246-' + i]).toBe(13);
  });
  it('bounds catch-up to a week', async () => {
    const prior = await restoreBitcoin(target - 200 * HOUR_MS, deps()),
      d = deps();
    d.load.mockResolvedValue({ state: prior, etag: 'v1' });
    expect(Date.parse((await restoreBitcoin(target, d)).hour)).toBe(
      target - 32 * HOUR_MS,
    );
  });
  it('uses the winning concurrent initialization', async () => {
    const winner = await restoreBitcoin(target, deps()),
      d = deps();
    d.load
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ state: winner, etag: 'winner' });
    d.save.mockRejectedValue({ $metadata: { httpStatusCode: 412 } });
    expect(await restoreBitcoin(target, d)).toBe(winner);
  });
  for (const failure of ['save', 'history', 'order', 'count'])
    it('retains saved graphics after ' + failure + ' failure', async () => {
      const prior = await restoreBitcoin(target - HOUR_MS, deps()),
        d = deps();
      d.load.mockResolvedValue({ state: prior, etag: 'v1' });
      if (failure === 'save')
        d.save.mockRejectedValue(new Error('storage unavailable'));
      if (failure === 'history') d.windows.mockRejectedValue(new Error('gap'));
      if (failure === 'order')
        d.windows.mockResolvedValue([price(100, 101, target - HOUR_MS)]);
      if (failure === 'count') d.windows.mockResolvedValue([]);
      const result = await restoreBitcoin(target, d);
      expect(result.overrides).toEqual(prior.overrides);
      expect(result.warning).toBeTruthy();
    });
  it('never resets an unreadable checkpoint or publishes an unsaved first state', async () => {
    const d = deps();
    d.load.mockRejectedValue(new Error('corrupt'));
    await expect(restoreBitcoin(target, d)).rejects.toThrow();
    expect(d.anchor).not.toHaveBeenCalled();
    const d2 = deps();
    d2.save.mockRejectedValue(new Error('write failed'));
    await expect(restoreBitcoin(target, d2)).rejects.toThrow();
  });
  it('rejects invalid checkpoint glyphs and unexpected controls', async () => {
    const result = await restoreBitcoin(target, deps());
    expect(() =>
      validateBitcoinCheckpoint({
        ...result,
        overrides: { ...result.overrides, '246-97': 14 },
      }),
    ).toThrow();
    expect(() =>
      validateBitcoinCheckpoint({
        ...result,
        overrides: { ...result.overrides, '247-0': 1 },
      }),
    ).toThrow();
    const overrides = { ...result.overrides };
    delete overrides['246-0'];
    overrides['246-00'] = 1;
    expect(() => validateBitcoinCheckpoint({ ...result, overrides })).toThrow();
  });
});
