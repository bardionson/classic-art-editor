import { bitcoinTransforms, ethBoyStep, MarketPrice } from './artwork-market';

export const HOUR_MS = 3_600_000;
export const CLASSIC_V2 = '0xb6dae651468e9593e4581705a09c10a76ac1e0c8';
export const CLASSIC_V1 = '0x6c424c25e9f1fff9642cb5b7750b0db7312c29ad';
export function priceArtworkId(address: string, id: number): 807 | 245 | null {
  const contract = address.toLowerCase();
  if (contract === CLASSIC_V2 && id === 807) return 807;
  if ([CLASSIC_V1, CLASSIC_V2].includes(contract) && id === 245) return 245;
  return null;
}
export type HourlyArtwork = {
  version: 1;
  tokenId: 807 | 245;
  hour: string;
  source: 'Coinbase Exchange';
  mode: 'independent-hourly-restoration';
  overrides: Record<string, number>;
  warning?: string;
};
export type EthCheckpoint = HourlyArtwork & {
  tokenId: 807;
  anchor: {
    block: string;
    observedAt: string;
    background: number;
    butterflyY: number;
  };
  inputs: { ETH: MarketPrice; BTC: MarketPrice; gasGwei: number | null };
};
const clamp = (value: number, bound: number) =>
  Math.max(-bound, Math.min(bound, Math.round(value)));
export function bitcoinOverrides(price: MarketPrice): Record<string, number> {
  return Object.fromEntries(
    bitcoinTransforms(price.hourly).flatMap((row, i) =>
      [row.scale, row.rotation, row.x, row.y].map((value, lever) => [
        `246-${i * 4 + lever}`,
        value,
      ]),
    ),
  );
}
/** Price-only controls. Fire, random butterfly appearance/X and artist styling stay on chain. */
export function ethOverrides(
  background: number,
  butterflyY: number,
  eth: MarketPrice,
  btc: MarketPrice,
  hour: number,
  gasGwei: number | null,
): Record<string, number> {
  const step = ethBoyStep(eth, btc, new Date(hour), gasGwei);
  const face = [
    'Very happy',
    'Happy',
    'Slightly happy',
    'Slightly sad',
    'Sad',
    'Very sad',
    'Neutral',
  ].indexOf(step.face);
  const result: Record<string, number> = {
    '808-0': clamp(background + step.backgroundDelta, 10420),
    '808-3': face,
    '808-4':
      step.object === 'Birthday cake' ? 1 : step.object === 'None' ? 2 : 0,
    '808-8': clamp(butterflyY + step.butterflyYDelta, 1080),
  };
  if (step.clothing) {
    result['808-1'] = Math.round(step.clothing.greenPercent);
    result['808-2'] = Math.round(step.clothing.redPercent);
  }
  return result;
}
export function renderingOverrides(
  hourly: Record<string, number>,
  local: Record<string, number>,
) {
  return { ...hourly, ...local };
}
