import { afterEach, expect, it, vi } from 'vitest';
import { getLayersFromMetadata } from '@/components/master-art-viewer/utils';
import { getTimeStateIndex, watchArtworkTime } from './artwork-time';
import rawFixtures from './fixtures/automation-metadata.json';

// Archived layouts include several schema versions and nested state shapes.
const fixtures: Array<{
  tokenId: string;
  metadataUri: string;
  offset: number;
  layout: { layers: any[] };
}> = rawFixtures;

vi.mock('@/utils/rpcClient', () => ({ publicClient: {} }));
afterEach(() => vi.useRealTimers());

it.each(
  fixtures.filter(
    (f) => f.layout.layers[0].states.time?.type === 'HOUR_OF_DAY',
  ),
)(
  'matches original server hour rules and image selection for master $tokenId',
  async (fixture) => {
    const states = fixture.layout.layers[0].states;
    const controls = vi.fn(async () => 0);
    for (let hour = 0; hour < 24; hour++) {
      let expected = 0;
      for (const [start, end, index] of (states.time.handler as any).rules) {
        if (hour >= start && hour <= end) expected = index;
      }
      if (
        states.options[2]?.label === 'Sunset' &&
        states.options[3]?.label === 'Sunrise'
      ) {
        if (expected === 2) expected = 3;
        else if (expected === 3) expected = 2;
      }
      const now = new Date(Date.UTC(2026, 10, 7, hour) - fixture.offset * 1000);
      const layers = await getLayersFromMetadata(
        fixture.layout.layers as any,
        controls,
        {
          now,
          utcOffsetSeconds: fixture.offset,
        },
      );
      let expectedLeaf: any = states.options[expected];
      while (expectedLeaf.states) expectedLeaf = expectedLeaf.states.options[0];
      expect(layers[0].activeStateURI).toBe(expectedLeaf.uri);
    }
    if (!states.options.some((option: any) => option.states))
      expect(controls).not.toHaveBeenCalled();
  },
);
it('uses the final matching inclusive range, as the original server did', () => {
  expect(
    getTimeStateIndex(
      {
        type: 'HOUR_OF_DAY',
        handler: {
          type: 'CUSTOM',
          rules: [
            [0, 6, 1],
            [6, 18, 0],
          ],
        },
      },
      new Date('2026-11-07T06:00:00Z'),
    ),
  ).toBe(0);
});
it('switches exactly at a quarter-hour-offset boundary', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-07T00:14:59Z'));
  const fixture = fixtures.find((f) => f.tokenId === '800')!;
  const callback = vi.fn();
  const stop = watchArtworkTime(fixture.layout.layers, 20700, callback);
  vi.advanceTimersByTime(1000);
  expect(callback).toHaveBeenCalledOnce();
  stop();
  expect(vi.getTimerCount()).toBe(0);
});
it('resolves every calendar day in the retrieved daily/monthly fixtures', async () => {
  const calendar = fixtures.filter(
    (f) =>
      f.layout.layers[0].states.time &&
      f.layout.layers[0].states.time.type !== 'HOUR_OF_DAY',
  );
  for (const fixture of calendar) {
    for (let day = 0; day < 366; day++) {
      const result = await getLayersFromMetadata(
        fixture.layout.layers as any,
        vi.fn(),
        {
          now: new Date(Date.UTC(2024, 0, 1 + day)),
          utcOffsetSeconds: fixture.offset || 0,
        },
      );
      expect(result[0].activeStateURI).toBeTruthy();
    }
  }
});

it('resolves nested timed states for both owner-selected branches of master 1979', async () => {
  const fixture = fixtures.find((f) => f.tokenId === '1979')!;
  for (const branch of [0, 1]) {
    for (let hour = 0; hour < 24; hour++) {
      const selected = fixture.layout.layers[0].states.options[branch] as any;
      const now = new Date(
        Date.UTC(2026, 10, 7, hour) - (fixture.offset || 0) * 1000,
      );
      const expected = getTimeStateIndex(
        selected.states.time,
        now,
        fixture.offset || 0,
      );
      const result = await getLayersFromMetadata(
        fixture.layout.layers as any,
        vi.fn(async () => branch),
        { now, utcOffsetSeconds: fixture.offset || 0 },
      );
      expect(result[0].activeStateURI).toBe(
        selected.states.options[expected].uri,
      );
    }
  }
});
