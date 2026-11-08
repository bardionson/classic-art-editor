import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('./r2-audio', () => ({ audioStorageConnection: vi.fn() }));
import {
  hourlyWindows,
  restoreEthBoy,
  validateCheckpoint,
} from './artwork-hourly-server';
import { EthCheckpoint, HOUR_MS } from './artwork-hourly';
import { MarketPrice } from './artwork-market';
const target = Date.parse('2026-11-08T12:00:00Z');
function price(symbol: 'ETH' | 'BTC', hour: number): MarketPrice {
  const hourly = Array.from({ length: 25 }, (_, i) => ({
    closedAt: new Date(hour - (24 - i) * HOUR_MS).toISOString(),
    usd: 100 + i / 24,
  }));
  return {
    symbol,
    hourly,
    usd: 101,
    tradedAt: new Date(hour).toISOString(),
    change24hPercent: 1,
  };
}
function dependencies() {
  return {
    load: vi
      .fn<() => Promise<{ state: EthCheckpoint; etag: string } | null>>()
      .mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    anchor: vi.fn().mockResolvedValue({
      block: '123',
      observedAt: new Date(target).toISOString(),
      background: 0,
      butterflyY: 0,
    }),
    windows: vi.fn(async (symbol: 'ETH' | 'BTC', first: number, last: number) =>
      Array.from({ length: (last - first) / HOUR_MS + 1 }, (_, i) =>
        price(symbol, first + i * HOUR_MS),
      ),
    ),
    gas: vi.fn().mockResolvedValue(null),
  };
}
afterEach(() => vi.unstubAllGlobals());
describe('shared hourly checkpoints', () => {
  it('anchors once and persists before publishing the first hour', async () => {
    const deps = dependencies();
    const result = await restoreEthBoy(target, deps);
    expect(result.overrides).toMatchObject({ '808-0': 208, '808-8': -22 });
    expect(result.anchor.block).toBe('123');
    expect(deps.save).toHaveBeenCalledWith(result, undefined);
    expect(validateCheckpoint(result)).toBe(result);
  });
  it('never reapplies a completed hour or reads prices again', async () => {
    const first = await restoreEthBoy(target, dependencies());
    const deps = dependencies();
    deps.load.mockResolvedValue({ state: first, etag: 'version1' });
    expect(await restoreEthBoy(target, deps)).toEqual(first);
    expect(deps.windows).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.anchor).not.toHaveBeenCalled();
  });
  it('replays each skipped hour once using the saved positions and conditional version', async () => {
    const first = await restoreEthBoy(target - 3 * HOUR_MS, dependencies());
    const deps = dependencies();
    deps.load.mockResolvedValue({ state: first, etag: 'version1' });
    const result = await restoreEthBoy(target, deps);
    expect(result.overrides).toMatchObject({ '808-0': 832, '808-8': -88 });
    expect(deps.windows).toHaveBeenCalledWith(
      'ETH',
      target - 2 * HOUR_MS,
      target,
    );
    expect(deps.save).toHaveBeenCalledWith(result, 'version1');
    expect(deps.anchor).not.toHaveBeenCalled();
  });
  it('bounds long recovery to a week and does not use current gas for an old hour', async () => {
    const first = await restoreEthBoy(target - 200 * HOUR_MS, dependencies());
    const deps = dependencies();
    deps.load.mockResolvedValue({ state: first, etag: 'version1' });
    const result = await restoreEthBoy(target, deps);
    expect(Date.parse(result.hour)).toBe(target - 32 * HOUR_MS);
    expect(deps.gas).not.toHaveBeenCalled();
    expect(result.overrides['808-1']).toBeUndefined();
  });
  it('returns the winning checkpoint if two visitors initialize concurrently', async () => {
    const winner = await restoreEthBoy(target, dependencies());
    const deps = dependencies();
    deps.load
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ state: winner, etag: 'winner' });
    deps.save.mockRejectedValue({ $metadata: { httpStatusCode: 412 } });
    expect(await restoreEthBoy(target, deps)).toBe(winner);
    expect(deps.save).toHaveBeenCalledTimes(1);
  });
  it('retains the last saved hour when price history is missing', async () => {
    const first = await restoreEthBoy(target - HOUR_MS, dependencies());
    const deps = dependencies();
    deps.load.mockResolvedValue({ state: first, etag: 'v1' });
    deps.windows.mockRejectedValue(new Error('Missing candles'));
    expect(await restoreEthBoy(target, deps)).toMatchObject({
      hour: first.hour,
      overrides: first.overrides,
      warning: expect.any(String),
    });
    expect(deps.save).not.toHaveBeenCalled();
  });
  it('does not publish unpersisted initial state or reset on storage read failures', async () => {
    const deps = dependencies();
    deps.save.mockRejectedValue(new Error('Storage unavailable'));
    await expect(restoreEthBoy(target, deps)).rejects.toThrow(
      'Storage unavailable',
    );
    deps.load.mockRejectedValue(new Error('Access denied'));
    deps.anchor.mockClear();
    await expect(restoreEthBoy(target, deps)).rejects.toThrow('Access denied');
    expect(deps.anchor).not.toHaveBeenCalled();
  });
  it('rejects out-of-order replay without advancing the checkpoint', async () => {
    const deps = dependencies();
    deps.windows.mockImplementation(async (symbol) => [
      price(symbol, target - HOUR_MS),
    ]);
    await expect(restoreEthBoy(target, deps)).rejects.toThrow(
      'Out-of-order replay',
    );
    expect(deps.save).not.toHaveBeenCalled();
  });
  it('does not accept corrupt or future checkpoints', async () => {
    const state = await restoreEthBoy(target, dependencies());
    expect(() =>
      validateCheckpoint({
        ...state,
        overrides: { ...state.overrides, '808-8': NaN },
      }),
    ).toThrow();
    expect(() =>
      validateCheckpoint({
        ...state,
        overrides: { ...state.overrides, '247-0': 1 },
      }),
    ).toThrow();
    const deps = dependencies();
    deps.load.mockResolvedValue({ state, etag: 'v1' });
    await expect(restoreEthBoy(target - HOUR_MS, deps)).rejects.toThrow(
      'future',
    );
  });
});
describe('historical hourly windows', () => {
  it('validates consecutive closes for every replayed hour and rejects a missing candle', async () => {
    const candles = Array.from({ length: 28 }, (_, i) => [
      (target - (28 - i) * HOUR_MS) / 1000,
      90,
      150,
      100,
      100 + i,
      1,
    ]);
    const fetcher = vi.fn(async () => new Response(JSON.stringify(candles)));
    vi.stubGlobal('fetch', fetcher);
    const result = await hourlyWindows('BTC', target - 3 * HOUR_MS, target);
    expect(result).toHaveLength(4);
    expect(result[3].hourly[24].closedAt).toBe(new Date(target).toISOString());
    candles.splice(5, 1);
    await expect(
      hourlyWindows('BTC', target - 3 * HOUR_MS, target),
    ).rejects.toThrow('Missing');
  });
});
