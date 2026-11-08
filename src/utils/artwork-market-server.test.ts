import { afterEach, describe, expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => ({ getGasPrice: vi.fn(), getBlock: vi.fn() }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('viem', () => ({ createPublicClient: () => rpc, http: vi.fn() }));
import { collectMarketReport } from './artwork-market-server';
const now = Date.parse('2026-11-08T12:20:00Z');
function mockPrices() {
  const fetcher = vi.fn(
    async (input: string) =>
      new Response(
        JSON.stringify(
          input.includes('/ticker')
            ? { price: '120', time: new Date(now).toISOString() }
            : Array.from({ length: 25 }, (_, i) => [
                Date.parse('2026-11-08T12:00:00Z') / 1000 - (25 - i) * 3600,
                90,
                150,
                100,
                100 + i,
                1,
              ]),
        ),
      ),
  );
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe('market report service', () => {
  it('fetches only fixed public ETH/BTC endpoints and returns auditable inputs', async () => {
    vi.stubEnv('ALCHEMY_KEY', '');
    const fetcher = mockPrices();
    const report = await collectMarketReport(now);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(
      fetcher.mock.calls.every(([url]) =>
        url.startsWith('https://api.exchange.coinbase.com/products/'),
      ),
    ).toBe(true);
    expect(report).toMatchObject({
      version: 1,
      mode: 'calculation-only',
      gas: null,
      checkedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 300000).toISOString(),
    });
    expect(report.bitcoin).toHaveLength(24);
    expect(report.prices.BTC.hourly).toHaveLength(25);
  });
  it('fails when the provider fails instead of returning zero prices', async () => {
    vi.stubEnv('ALCHEMY_KEY', '');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 429 })),
    );
    await expect(collectMarketReport(now)).rejects.toThrow(
      'Price provider unavailable',
    );
  });
  it('does not let an unavailable gas estimate block price checks', async () => {
    vi.stubEnv('ALCHEMY_KEY', 'test');
    mockPrices();
    rpc.getGasPrice.mockRejectedValue(new Error('unavailable'));
    rpc.getBlock.mockResolvedValue({
      timestamp: BigInt(now / 1000),
      number: BigInt(5),
    });
    expect((await collectMarketReport(now)).gas).toBeNull();
  });
  it('includes fresh gas with provenance and rejects a stale block', async () => {
    vi.stubEnv('ALCHEMY_KEY', 'test');
    mockPrices();
    rpc.getGasPrice.mockResolvedValue(BigInt(5000000000));
    rpc.getBlock.mockResolvedValue({
      timestamp: BigInt(now / 1000),
      number: BigInt(5),
    });
    expect((await collectMarketReport(now)).gas).toMatchObject({
      gwei: 5,
      block: '5',
    });
    rpc.getBlock.mockResolvedValue({
      timestamp: BigInt(now / 1000 - 601),
      number: BigInt(4),
    });
    expect((await collectMarketReport(now)).gas).toBeNull();
  });
});
