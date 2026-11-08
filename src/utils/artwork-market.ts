// Calculations adapted from asyncart/autonomous-scripts (MIT).
// Copyright (c) 2020 Asynchronous Art, Inc. See docs/licenses/autonomous-scripts.txt.
export const HOUR = 3600;
export const CHECK_INTERVAL = 5 * 60 * 1000;
export type Symbol = 'ETH' | 'BTC';
export type HourlyPrice = { closedAt: string; usd: number };
export type MarketPrice = {
  symbol: Symbol;
  usd: number;
  tradedAt: string;
  hourly: HourlyPrice[];
  change24hPercent: number;
};

/** 25 completed hourly closes describe 24 price-change intervals. Never fill gaps. */
export function parseHourlyPrices(raw: unknown, now: number): HourlyPrice[] {
  if (!Array.isArray(raw)) throw new Error('Invalid hourly prices');
  const hour = Math.floor(now / 1000 / HOUR) * HOUR;
  const byTime = new Map<number, number>();
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 5)
      throw new Error('Invalid candle');
    const [time, low, high, open, close] = row;
    if (
      ![time, low, high, open, close].every(Number.isFinite) ||
      time % HOUR !== 0 ||
      low <= 0 ||
      high < low ||
      open < low ||
      open > high ||
      close < low ||
      close > high
    )
      throw new Error('Invalid candle');
    if (time >= hour || time < hour - 25 * HOUR) continue;
    if (byTime.has(time) && byTime.get(time) !== close)
      throw new Error('Conflicting hourly prices');
    byTime.set(time, close);
  }
  return Array.from({ length: 25 }, (_, i) => {
    const time = hour - (25 - i) * HOUR;
    const usd = byTime.get(time);
    if (usd === undefined) throw new Error('Missing or stale hourly prices');
    return { closedAt: new Date((time + HOUR) * 1000).toISOString(), usd };
  });
}

export function parseMarketPrice(
  symbol: Symbol,
  ticker: unknown,
  candles: unknown,
  now: number,
): MarketPrice {
  const tick = ticker as { price?: unknown; time?: unknown } | null;
  const usd = typeof tick?.price === 'string' ? Number(tick.price) : NaN;
  const timestamp =
    typeof tick?.time === 'string' ? Date.parse(tick.time) : NaN;
  if (
    !Number.isFinite(usd) ||
    usd <= 0 ||
    !Number.isFinite(timestamp) ||
    timestamp > now + 60_000 ||
    now - timestamp > 10 * 60_000
  )
    throw new Error('Invalid or stale market quote');
  const hourly = parseHourlyPrices(candles, now);
  return {
    symbol,
    usd,
    tradedAt: new Date(timestamp).toISOString(),
    hourly,
    change24hPercent: (hourly[24].usd / hourly[0].usd - 1) * 100,
  };
}

export function ethBoyStep(
  eth: MarketPrice,
  btc: MarketPrice,
  date: Date,
  gasGwei: number | null,
) {
  const ethChange = eth.change24hPercent / 100;
  const btcChange = btc.change24hPercent / 100;
  const step = (change: number, distance: number) =>
    change > 0.1
      ? distance * 5
      : change < -0.1
        ? -distance * 5
        : Math.sign(change) * distance;
  // Preserve the original inclusive thresholds and first matching facial rule.
  const face =
    ethChange >= 0.3
      ? 'Very happy'
      : ethChange >= 0.2
        ? 'Happy'
        : ethChange >= 0.1
          ? 'Slightly happy'
          : ethChange <= -0.3
            ? ethChange === -0.3
              ? 'Sad'
              : 'Very sad'
            : ethChange <= -0.2
              ? ethChange === -0.2
                ? 'Slightly sad'
                : 'Sad'
              : ethChange <= -0.1
                ? 'Slightly sad'
                : 'Neutral';
  const object =
    date.getUTCMonth() === 0 && date.getUTCDate() === 31
      ? 'Birthday cake'
      : date.getUTCMonth() === 6 && date.getUTCDate() === 30
        ? 'Baby (Ethereum launch anniversary)'
        : 'None';
  return {
    backgroundDelta: step(ethChange, 208),
    butterflyYDelta: -step(btcChange, 22),
    face,
    object,
    clothing:
      gasGwei === null
        ? null
        : {
            greenPercent: Math.min(100, Math.max(0, 100 - gasGwei)),
            redPercent: Math.min(100, Math.max(0, gasGwei - 100)),
          },
  };
}

/** The original 24-layer transforms. Flat markets explicitly produce zero rotation. */
export function bitcoinTransforms(hourly: HourlyPrice[]) {
  if (
    hourly.length !== 25 ||
    hourly.some((p) => !Number.isFinite(p.usd) || p.usd <= 0)
  )
    throw new Error('Expected 25 positive hourly prices');
  const prices = hourly.map((p) => Math.round(p.usd));
  const min = Math.min(...prices),
    max = Math.max(...prices),
    diff = max - min;
  const volatility = diff / max;
  const gain = prices[24] > prices[0];
  const multiplier = volatility * 10;
  const clamp = (n: number, low: number, high: number) =>
    Math.min(high, Math.max(low, Math.round(n)));
  return Array.from({ length: 24 }, (_, i) => {
    const delta = prices[i + 1] - prices[i];
    const fraction = diff === 0 ? 0 : delta / diff;
    return {
      hour: i + 1,
      from: hourly[i].closedAt,
      to: hourly[i + 1].closedAt,
      scale: clamp(
        100 + volatility * (gain ? 500 : -50) + fraction * 100,
        40,
        500,
      ),
      rotation:
        diff === 0
          ? 0
          : Math.round(
              ((360 - ((delta + diff) / (2 * diff)) * 720) * multiplier) % 360,
            ),
      x: clamp(multiplier * 1024 * fraction, -2048, 2048),
      y: clamp(multiplier * 576 * fraction, -2048, 2048),
    };
  });
}

export type MarketReport = {
  version: 1;
  checkedAt: string;
  expiresAt: string;
  source: 'Coinbase Exchange';
  mode: 'calculation-only';
  prices: { ETH: MarketPrice; BTC: MarketPrice };
  gas: {
    gwei: number;
    block: string;
    blockTime: string;
    source: 'Ethereum eth_gasPrice';
  } | null;
  ethBoy: ReturnType<typeof ethBoyStep>;
  bitcoin: ReturnType<typeof bitcoinTransforms>;
};
