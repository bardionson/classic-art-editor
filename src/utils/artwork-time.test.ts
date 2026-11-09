import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getTimeStateIndex,
  getArtworkUtcOffset,
  watchArtworkTime,
  type ArtworkTimeRule,
} from './artwork-time';
import { getLayersFromMetadata } from '@/components/master-art-viewer/utils';

vi.mock('@/utils/rpcClient', () => ({ publicClient: {} }));

// From master #800's canonical metadata:
// QmeC3ti3uB2qwLqeQ4y3VYLAFebVpSdyqTVX3KajWed6mN
const rule: ArtworkTimeRule = {
  type: 'HOUR_OF_DAY',
  handler: {
    type: 'CUSTOM',
    rules: [
      [0, 5, 1],
      [6, 18, 0],
      [19, 23, 1],
    ],
  },
};
const layers = [
  {
    id: 'Background',
    states: {
      time: rule,
      options: [
        { label: 'Day', uri: 'QmbppU4xjqAP7wxkjZrhfnwaHh38Hqp9rdYwMXY77CyyxN' },
        {
          label: 'Night',
          uri: 'QmSgnEVJ4w7Ltn3vwgSnn9JeQCahSf67cUo4hXi2RNM6v4',
        },
      ],
    },
  },
];

afterEach(() => vi.useRealTimers());

describe('master 800 metadata clock', () => {
  it.each([
    ['2026-11-07T04:59:59Z', 1],
    ['2026-11-07T05:00:00Z', 0],
    ['2026-11-07T17:59:59Z', 0],
    ['2026-11-07T18:00:00Z', 1],
    ['2026-11-07T23:30:00Z', 1],
    ['2026-07-07T05:00:00Z', 0],
  ])('selects the canonical state at %s (fixed UTC+1)', (iso, state) => {
    expect(getTimeStateIndex(rule, new Date(iso), 3600)).toBe(state);
  });

  it('passes the timezone through actual layer selection', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T05:00:00Z'));
    const controls = vi.fn();
    const result = await getLayersFromMetadata(layers, controls, {
      now: new Date('2026-11-07T05:00:00Z'),
      utcOffsetSeconds: 3600,
    });
    expect(result[0].activeStateURI).toBe(layers[0].states.options[0].uri);
    expect(controls).not.toHaveBeenCalled();
  });

  it('switches at the boundary, skips unchanged hours, and cleans up', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T04:59:59Z'));
    const changed = vi.fn();
    const stop = watchArtworkTime(layers, 3600, changed);
    vi.advanceTimersByTime(1000);
    expect(changed).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(12 * 3_600_000);
    expect(changed).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3_600_000);
    expect(changed).toHaveBeenCalledTimes(2);
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('catches up when a suspended tab becomes visible', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T04:00:00Z'));
    const target = new EventTarget();
    const changed = vi.fn();
    const stop = watchArtworkTime(layers, 3600, changed, target);
    vi.setSystemTime(new Date('2026-11-07T06:00:00Z'));
    target.dispatchEvent(new Event('visibilitychange'));
    expect(changed).toHaveBeenCalledTimes(1);
    stop();
    vi.setSystemTime(new Date('2026-11-07T19:00:00Z'));
    target.dispatchEvent(new Event('visibilitychange'));
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('does not schedule static artworks and discovers nested timed states', () => {
    vi.useFakeTimers();
    watchArtworkTime([{ id: 'Static', uri: 'cid' }], 0, vi.fn());
    expect(vi.getTimerCount()).toBe(0);
    const stop = watchArtworkTime(
      [{ states: { options: layers } }],
      3600,
      vi.fn(),
    );
    expect(vi.getTimerCount()).toBe(1);
    stop();
  });

  it('keeps seconds integral and calendar dates in the metadata timezone', () => {
    const seconds: ArtworkTimeRule = {
      type: 'SECONDS',
      handler: { type: 'MODULO', max_bound_inclusive: 1 },
    };
    expect(getTimeStateIndex(seconds, new Date(1500), 3600)).toBe(1);
    const day: ArtworkTimeRule = {
      type: 'DAY_OF_YEAR',
      handler: { type: 'MODULO', max_bound_inclusive: 366 },
    };
    expect(getTimeStateIndex(day, new Date('2026-12-31T23:30:00Z'), 3600)).toBe(
      1,
    );
  });
});

it('honors #571 legacy GMT-06:00 without guessing daylight saving', () => {
  expect(
    getArtworkUtcOffset({
      'async-attributes': {
        timezone: '(GMT-06:00) Central Time (US & Canada)',
      },
    }),
  ).toBe(-21600);
  expect(
    getArtworkUtcOffset({
      'async-attributes': { timezone: { default_utc_offset: 20700 } },
    }),
  ).toBe(20700);
  expect(
    getArtworkUtcOffset({ 'async-attributes': { timezone: 'Unknown' } }),
  ).toBe(0);
});

it('changes timed opacity while preserving the selected collector variant and metadata', async () => {
  const opacity = {
    time: {
      type: 'HOUR_OF_DAY',
      handler: {
        type: 'CUSTOM',
        rules: [
          [0, 5, 80],
          [6, 6, 65],
          [7, 18, 55],
          [19, 23, 80],
        ],
      },
    },
  };
  const variants: any = [
    {
      id: 'Sign',
      states: {
        'token-id': 1,
        'lever-id': 0,
        options: [
          { uri: 'first', color: { alpha: opacity } },
          { uri: 'second', color: { alpha: opacity } },
        ],
      },
    },
  ];
  const original = JSON.stringify(variants);
  for (const [hour, alpha] of [
    [5, 80],
    [6, 65],
    [7, 55],
    [18, 55],
    [19, 80],
  ]) {
    const selected = await getLayersFromMetadata(variants, async () => 1, {
      now: new Date(Date.UTC(2026, 10, 8, hour + 8)),
      utcOffsetSeconds: -28800,
    });
    expect(selected[0].activeStateURI).toBe('second');
    expect(selected[0].transformationProperties.color?.alpha).toBe(alpha);
  }
  expect(JSON.stringify(variants)).toBe(original);
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-08T14:59:59Z'));
  const changed = vi.fn();
  const stop = watchArtworkTime(variants, -28800, changed);
  vi.advanceTimersByTime(1000);
  expect(changed).toHaveBeenCalledOnce();
  stop();
});
