import { HourlyPrice, MarketPrice } from './artwork-market';
import { HourlyArtwork } from './artwork-hourly';

export type BitcoinCheckpoint = HourlyArtwork & {
  tokenId: 245;
  anchor: {
    contract: string;
    block: string;
    observedAt: string;
    milestones: Record<string, number>;
  };
  inputs: { BTC: MarketPrice };
};

/** Sparse writes from asyncart/autonomous-scripts@931217c, Matt Kane's original update.js.
 * Down/flat hours retain earlier graphics; special badges retain earlier digits.
 * The original fixed $19,783 ATH has priority, and drop uses the window range/max.
 */
export function bitcoinMilestoneChanges(
  hourly: HourlyPrice[],
): Record<string, number> {
  if (
    hourly.length !== 25 ||
    hourly.some((p) => !Number.isFinite(p.usd) || p.usd <= 0)
  )
    throw new Error('Invalid milestone price window');
  const prices = hourly.map((p) => Math.round(p.usd));
  const first = prices[0],
    last = prices[24];
  if (first >= last) {
    const max = Math.max(...prices);
    return max > 0 && (max - Math.min(...prices)) / max >= 0.2
      ? { '246-96': 0 }
      : {};
  }
  const special = [
    9000, 11000, 33000, 50000, 90000, 100000, 250000, 500000, 750000, 900000,
    1000000, 9000000, 19783,
  ];
  for (let i = special.length - 1; i >= 0; i--)
    if (first < special[i] && last >= special[i]) return { '246-96': i + 1 };
  let label = 'xxxxx';
  const multiple = last < 1000 ? 1 : 1000;
  const markers =
    last < 1000
      ? [1, 13, 31, 266, 504, 630, 750]
      : [
          1, 2, 3, 4, 5, 6, 7, 8, 10, 20, 25, 30, 40, 60, 69, 75, 88, 99, 125,
          150, 175, 200, 222, 275, 300, 333, 350, 400, 444, 666, 888,
        ];
  if (last >= 1 && last < 1000000) {
    for (let i = markers.length - 1; i >= 0; i--) {
      if (first < markers[i] * multiple && last >= markers[i] * multiple) {
        label = '$' + markers[i] + (multiple === 1000 ? 'K' : '');
        break;
      }
    }
  } else if (
    last >= 1000000 &&
    last < 1000000000 &&
    Math.round(last / 1000000) > Math.round(first / 1000000)
  ) {
    label = '$' + Math.round(last / 1000000) + 'M';
  }
  // The original has only five glyph slots. Do not write a nonexistent sixth lever.
  if (label.length > 5)
    throw new Error('Milestone exceeds original five-character display');
  const padded = (label.length < 5 ? 'x' + label : label).padEnd(5, 'x');
  const values: Record<string, number> = { '246-96': 17 };
  padded.split('').forEach((c, i) => {
    values['246-' + (97 + i)] =
      c === '$'
        ? 0
        : c === 'K'
          ? 11
          : c === 'M'
            ? 12
            : /[0-9]/.test(c)
              ? Number(c) + 1
              : 13;
  });
  return values;
}
export function validMilestones(values: Record<string, number> | undefined) {
  return (
    !!values &&
    Array.from({ length: 6 }, (_, i) => i + 96).every(
      (i) =>
        Number.isSafeInteger(values['246-' + i]) &&
        values['246-' + i] >= 0 &&
        values['246-' + i] <= (i === 96 ? 17 : 13),
    )
  );
}
