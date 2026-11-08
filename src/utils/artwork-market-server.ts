import { unstable_cache } from 'next/cache';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import {
  CHECK_INTERVAL,
  MarketReport,
  Symbol,
  parseMarketPrice,
  ethBoyStep,
  bitcoinTransforms,
} from './artwork-market';

async function readJson(url: string) {
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': 'DigitalRescueLab-AsyncArchive/1.0' },
  });
  if (!response.ok) throw new Error('Price provider unavailable');
  return response.json();
}

export async function collectMarketReport(
  now = Date.now(),
): Promise<MarketReport> {
  const end = Math.floor(now / 3_600_000) * 3_600_000;
  const start = end - 26 * 3_600_000;
  async function price(symbol: Symbol) {
    const base = `https://api.exchange.coinbase.com/products/${symbol}-USD`;
    const [ticker, candles] = await Promise.all([
      readJson(`${base}/ticker`),
      readJson(
        `${base}/candles?granularity=3600&start=${new Date(start).toISOString()}&end=${new Date(end).toISOString()}`,
      ),
    ]);
    return parseMarketPrice(symbol, ticker, candles, now);
  }
  async function gas(): Promise<MarketReport['gas']> {
    if (!process.env.ALCHEMY_KEY) return null;
    try {
      const rpc = createPublicClient({
        chain: mainnet,
        transport: http(
          `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
          { timeout: 8000, retryCount: 0 },
        ),
      });
      const [wei, block] = await Promise.all([
        rpc.getGasPrice(),
        rpc.getBlock(),
      ]);
      const blockTime = Number(block.timestamp) * 1000;
      const gwei = Number(wei) / 1e9;
      if (
        !Number.isFinite(gwei) ||
        gwei < 0 ||
        now - blockTime > 600_000 ||
        blockTime > now + 60_000
      )
        return null;
      return {
        gwei,
        block: String(block.number),
        blockTime: new Date(blockTime).toISOString(),
        source: 'Ethereum eth_gasPrice',
      };
    } catch {
      return null;
    }
  }
  const [ETH, BTC, gasReading] = await Promise.all([
    price('ETH'),
    price('BTC'),
    gas(),
  ]);
  return {
    version: 1,
    checkedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + CHECK_INTERVAL).toISOString(),
    source: 'Coinbase Exchange',
    mode: 'calculation-only',
    prices: { ETH, BTC },
    gas: gasReading,
    ethBoy: ethBoyStep(ETH, BTC, new Date(now), gasReading?.gwei ?? null),
    bitcoin: bitcoinTransforms(BTC.hourly),
  };
}

// Five-minute bucket prevents a failed revalidation from serving an older hour as current.
// Validated reports are shared through Next's data cache; failures are not cached here.
const cachedReport = unstable_cache(
  async (_bucket: number) => collectMarketReport(),
  ['artwork-market-report-v1'],
  { revalidate: 300 },
);
export async function getMarketReport() {
  const report = await cachedReport(Math.floor(Date.now() / CHECK_INTERVAL));
  if (Date.parse(report.expiresAt) <= Date.now())
    throw new Error('Price reading expired');
  return report;
}
