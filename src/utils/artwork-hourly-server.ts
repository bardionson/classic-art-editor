import { unstable_cache } from 'next/cache';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import v2Abi from '@/abis/v2Abi';
import { audioStorageConnection } from './r2-audio';
import { MarketPrice, parseHourlyPrices, Symbol } from './artwork-market';
import { readJson, readMarketGas } from './artwork-market-server';
import {
  bitcoinOverrides,
  CLASSIC_V2,
  EthCheckpoint,
  ethOverrides,
  HOUR_MS,
  HourlyArtwork,
} from './artwork-hourly';

const KEY = 'archive-automation/v1/ethboy-hourly.json';
const base = {
  version: 1,
  source: 'Coinbase Exchange',
  mode: 'independent-hourly-restoration',
} as const;
// Each request can recover a week without exceeding Coinbase's 300-candle limit.
const MAX_REPLAY_HOURS = 168;
export async function hourlyWindows(
  symbol: Symbol,
  firstHour: number,
  lastHour: number,
) {
  if (
    firstHour > lastHour ||
    lastHour - firstHour >= MAX_REPLAY_HOURS * HOUR_MS
  )
    throw new Error('Invalid replay window');
  const start = new Date(firstHour - 25 * HOUR_MS).toISOString();
  const end = new Date(lastHour).toISOString();
  const raw = await readJson(
    `https://api.exchange.coinbase.com/products/${symbol}-USD/candles?granularity=3600&start=${start}&end=${end}`,
  );
  const windows: MarketPrice[] = [];
  for (let hour = firstHour; hour <= lastHour; hour += HOUR_MS) {
    const hourly = parseHourlyPrices(raw, hour);
    windows.push({
      symbol,
      hourly,
      usd: hourly[24].usd,
      tradedAt: hourly[24].closedAt,
      change24hPercent: (hourly[24].usd / hourly[0].usd - 1) * 100,
    });
  }
  return windows;
}

async function readAnchor(): Promise<EthCheckpoint['anchor']> {
  const key = process.env.ALCHEMY_KEY;
  if (!key) throw new Error('Chain anchor unavailable');
  const rpc = createPublicClient({
    chain: mainnet,
    transport: http(`https://eth-mainnet.g.alchemy.com/v2/${key}`, {
      timeout: 8000,
      retryCount: 0,
    }),
  });
  const block = await rpc.getBlock();
  const values = await rpc.readContract({
    address: CLASSIC_V2,
    abi: v2Abi,
    functionName: 'getControlToken',
    args: [BigInt(808)],
    blockNumber: block.number,
  });
  const background = Number(values[2]),
    butterflyY = Number(values[26]);
  if (
    !Number.isSafeInteger(background) ||
    Math.abs(background) > 10420 ||
    !Number.isSafeInteger(butterflyY) ||
    Math.abs(butterflyY) > 1080
  )
    throw new Error('Invalid recorded ETH Boy positions');
  return {
    block: String(block.number),
    observedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
    background,
    butterflyY,
  };
}
export function validateCheckpoint(raw: unknown): EthCheckpoint {
  const state = raw as EthCheckpoint;
  const hour = Date.parse(state?.hour);
  if (
    state?.version !== 1 ||
    state.tokenId !== 807 ||
    state.mode !== base.mode ||
    !Number.isFinite(hour) ||
    hour % HOUR_MS !== 0 ||
    !state.anchor?.block ||
    !state.inputs?.ETH ||
    !state.inputs?.BTC ||
    !Number.isSafeInteger(state.overrides?.['808-0']) ||
    Math.abs(state.overrides['808-0']) > 10420 ||
    !Number.isSafeInteger(state.overrides?.['808-8']) ||
    Math.abs(state.overrides['808-8']) > 1080 ||
    Object.entries(state.overrides).some(
      ([key, value]) =>
        !/^808-(0|1|2|3|4|8)$/.test(key) || !Number.isSafeInteger(value),
    )
  )
    throw new Error('Invalid restoration checkpoint');
  return state;
}

/** Dependency boundary makes concurrent initialization, replay, and storage failures testable. */
export async function restoreEthBoy(
  target: number,
  deps: {
    load: () => Promise<{ state: EthCheckpoint; etag: string } | null>;
    save: (state: EthCheckpoint, etag?: string) => Promise<void>;
    anchor: typeof readAnchor;
    windows: typeof hourlyWindows;
    gas: () => Promise<number | null>;
  },
): Promise<EthCheckpoint> {
  const prior = await deps.load();
  if (prior && Date.parse(prior.state.hour) > target)
    throw new Error('Checkpoint is in the future');
  if (prior && Date.parse(prior.state.hour) === target) return prior.state;
  try {
    const first = prior ? Date.parse(prior.state.hour) + HOUR_MS : target;
    const last = Math.min(target, first + (MAX_REPLAY_HOURS - 1) * HOUR_MS);
    const [eth, btc, anchor, gas] = await Promise.all([
      deps.windows('ETH', first, last),
      deps.windows('BTC', first, last),
      prior ? Promise.resolve(prior.state.anchor) : deps.anchor(),
      // Historical gas is not fabricated when catching up an older batch.
      last === target ? deps.gas() : Promise.resolve(null),
    ]);
    const count = (last - first) / HOUR_MS + 1;
    if (eth.length !== count || btc.length !== count)
      throw new Error('Incomplete replay');
    let background = prior?.state.overrides['808-0'] ?? anchor.background;
    let butterflyY = prior?.state.overrides['808-8'] ?? anchor.butterflyY;
    let overrides: Record<string, number> = {};
    for (let i = 0; i < count; i++) {
      const hour = first + i * HOUR_MS;
      if (
        Date.parse(eth[i].hourly[24].closedAt) !== hour ||
        Date.parse(btc[i].hourly[24].closedAt) !== hour
      )
        throw new Error('Out-of-order replay');
      overrides = ethOverrides(
        background,
        butterflyY,
        eth[i],
        btc[i],
        hour,
        i === count - 1 ? gas : null,
      );
      background = overrides['808-0'];
      butterflyY = overrides['808-8'];
    }
    const state: EthCheckpoint = {
      ...base,
      tokenId: 807,
      hour: new Date(last).toISOString(),
      anchor,
      overrides,
      inputs: { ETH: eth[count - 1], BTC: btc[count - 1], gasGwei: gas },
    };
    await deps.save(state, prior?.etag);
    return state;
  } catch (error) {
    // A competing visitor may already have committed the same update. Never apply it twice.
    const status = (error as { $metadata?: { httpStatusCode?: number } })
      ?.$metadata?.httpStatusCode;
    if (status === 412 || status === 409) {
      const winner = await deps.load();
      if (
        winner &&
        Date.parse(winner.state.hour) >=
          (prior ? Date.parse(prior.state.hour) : target)
      )
        return winner.state;
    }
    if (prior)
      return {
        ...prior.state,
        warning: 'Price update delayed; showing the last saved hour.',
      };
    throw error;
  }
}

export async function collectHourlyArtwork(
  tokenId: 807 | 245,
  now = Date.now(),
): Promise<HourlyArtwork> {
  const target = Math.floor(now / HOUR_MS) * HOUR_MS;
  if (tokenId === 245) {
    const [price] = await hourlyWindows('BTC', target, target);
    return {
      ...base,
      tokenId,
      hour: new Date(target).toISOString(),
      overrides: bitcoinOverrides(price),
    };
  }
  const storage = audioStorageConnection();
  if (!storage) throw new Error('Restoration storage unavailable');
  const { client, bucket } = storage;
  return restoreEthBoy(target, {
    load: async () => {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: KEY }),
          { abortSignal: AbortSignal.timeout(8000) },
        );
        if (!result.Body || !result.ETag)
          throw new Error('Incomplete checkpoint');
        return {
          state: validateCheckpoint(
            JSON.parse(await result.Body.transformToString()),
          ),
          etag: result.ETag,
        };
      } catch (error) {
        if ((error as { name?: string }).name === 'NoSuchKey') return null;
        throw error;
      }
    },
    save: async (state, etag) => {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: KEY,
          Body: JSON.stringify(state),
          ContentType: 'application/json',
          ...(etag ? { IfMatch: etag } : { IfNoneMatch: '*' }),
        }),
        { abortSignal: AbortSignal.timeout(8000) },
      );
    },
    anchor: readAnchor,
    windows: hourlyWindows,
    gas: async () => (await readMarketGas(now))?.gwei ?? null,
  });
}
// A minute allows provider/storage recovery and bounded catch-up without per-visitor fetches.
const cachedArtwork = unstable_cache(
  async (id: 807 | 245, _minute: number) => collectHourlyArtwork(id),
  ['hourly-artwork-v1'],
  { revalidate: 60 },
);
const cachedBitcoin = unstable_cache(
  async (hour: number) => collectHourlyArtwork(245, hour),
  ['hourly-bitcoin-artwork-v1'],
  { revalidate: 3600 },
);
export function getHourlyArtwork(id: 807 | 245) {
  if (id === 245)
    return cachedBitcoin(Math.floor(Date.now() / HOUR_MS) * HOUR_MS);
  return cachedArtwork(id, Math.floor(Date.now() / 60_000));
}
