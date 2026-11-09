/** Run with PROGRAMMABLE_INVENTORY and PROGRAMMABLE_RESULTS paths. Reads original
 * metadata and exercises the production state selector and live timer watcher.
 * This is a diagnostic audit: known failures are recorded, never relabeled passes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { it, expect, vi } from 'vitest';
import {
  getTimeStateIndex,
  watchArtworkTime,
  getArtworkUtcOffset,
  resolveTimedProperties,
} from '../src/utils/artwork-time';
import { getLayersFromMetadata } from '../src/components/master-art-viewer/utils';
vi.mock('@/utils/rpcClient', () => ({ publicClient: {} }));
const input = process.env.PROGRAMMABLE_INVENTORY;
it.skipIf(!input)(
  'audits every retrieved timer against its original metadata',
  async () => {
    const inventory = JSON.parse(readFileSync(input!, 'utf8'));
    const results: any[] = [];
    for (const work of inventory.works) {
      if (!work.rules?.some((r: any) => r.kind === 'time')) continue;
      const metadata = JSON.parse(readFileSync(work.metadataFile, 'utf8'));
      const offset = getArtworkUtcOffset(metadata);
      const errors = new Set<string>();
      const notes = new Set<string>();
      let cases = 0,
        transitions = 0;
      const types = new Set<string>();
      for (const entry of work.rules.filter((r: any) => r.kind === 'time')) {
        const rule = entry.rule;
        types.add(rule.type);
        const isState = entry.path.endsWith('.states.time');
        let parent: any = metadata;
        const keys =
          entry.path
            .slice(2, -(isState ? '.states.time' : '.time').length)
            .match(/[^.\[\]]+/g) || [];
        for (const key of keys) parent = parent[key];
        const dates: Date[] = [];
        if (rule.type === 'HOUR_OF_DAY') {
          for (let h = 0; h < 24; h++)
            for (const ms of [-1000, 0])
              dates.push(
                new Date(Date.UTC(2026, 10, 8, h) - offset * 1000 + ms),
              );
        } else if (
          ['MONTH', 'DAY_OF_MONTH', 'DAY_OF_YEAR'].includes(rule.type)
        ) {
          for (const year of [2024, 2025]) {
            const count = year === 2024 ? 366 : 365;
            for (let d = 0; d < count; d++)
              dates.push(new Date(Date.UTC(year, 0, d + 1) - offset * 1000));
          }
        } else if (rule.type === 'SECONDS' && rule.handler.type === 'CUSTOM') {
          dates.push(new Date());
          for (const [a, b] of rule.handler.rules)
            for (const v of [a - 1, a, a + 1, b - 1, b, b + 1])
              dates.push(new Date(v * 1000));
          notes.add(
            'Absolute-date rules retain the original date ranges; dates outside them select the original default.',
          );
        } else {
          errors.add(`Unsupported timer rule: ${rule.type}`);
          continue;
        }
        let previousIndex: number | undefined;
        for (const now of dates) {
          cases++;
          try {
            const date = new Date(now.getTime() + offset * 1000);
            const dayOfYear =
              Array.from({ length: date.getUTCMonth() }, (_, m) =>
                new Date(
                  Date.UTC(date.getUTCFullYear(), m + 1, 0),
                ).getUTCDate(),
              ).reduce((a, b) => a + b, 0) + date.getUTCDate();
            const measure: Record<string, number> = {
              SECONDS: Math.floor(now.getTime() / 1000),
              HOUR_OF_DAY: date.getUTCHours(),
              MONTH: date.getUTCMonth(),
              DAY_OF_MONTH: date.getUTCDate() - 1,
              DAY_OF_YEAR: dayOfYear,
            };
            const matches =
              rule.handler.type === 'CUSTOM'
                ? rule.handler.rules.filter(
                    ([a, b]: number[]) =>
                      a <= measure[rule.type] && measure[rule.type] <= b,
                  )
                : [];
            if (new Set(matches.map((x: number[]) => x[2])).size > 1)
              notes.add(
                'Overlapping ranges: archived server and renderer disagree on precedence; visual review required.',
              );
            const expected =
              rule.handler.type === 'MODULO'
                ? measure[rule.type] % (rule.handler.max_bound_inclusive + 1)
                : (matches.at(-1)?.[2] ?? 0);
            const actual = getTimeStateIndex(rule, now, offset);
            if (
              actual !== expected ||
              !Number.isInteger(actual) ||
              (isState && !parent.states.options[actual])
            )
              throw new Error(
                `Invalid state ${actual} at ${now.toISOString()} (${entry.path})`,
              );
            if (previousIndex !== undefined && actual !== previousIndex)
              transitions++;
            previousIndex = actual;
            if (!isState) {
              if (resolveTimedProperties(parent, now, offset) !== expected)
                throw new Error(`Wrong timed transformation at ${entry.path}`);
              continue;
            }
            const selected = await getLayersFromMetadata(
              [parent],
              async () => 0,
              { now, utcOffsetSeconds: offset },
            );
            if (
              selected.some(
                (x) =>
                  typeof x.activeStateURI !== 'string' || !x.activeStateURI,
              )
            )
              throw new Error(`Selected state has no image URI: ${entry.path}`);
          } catch (e) {
            errors.add(String(e));
          }
        }
      }
      // Every hourly boundary must notify only when at least one selected state changes.
      const stateRules = work.rules.filter((r: any) => r.kind === 'time');
      let watcherChecks = 0;
      if (
        stateRules.length &&
        Array.from(types).every((t) => t === 'HOUR_OF_DAY')
      ) {
        vi.useFakeTimers();
        try {
          for (let hour = 0; hour < 24; hour++) {
            const before = Date.UTC(2026, 10, 8, hour) - offset * 1000 - 1000;
            vi.setSystemTime(before);
            const changed = vi.fn();
            const stop = watchArtworkTime(
              metadata.layout.layers,
              offset,
              changed,
            );
            const expected = stateRules.some(
              (r: any) =>
                getTimeStateIndex(r.rule, new Date(before), offset) !==
                getTimeStateIndex(r.rule, new Date(before + 1000), offset),
            );
            vi.advanceTimersByTime(1000);
            if (changed.mock.calls.length !== (expected ? 1 : 0))
              errors.add(`Live refresh mismatch at local hour ${hour}`);
            stop();
            watcherChecks++;
          }
        } finally {
          vi.useRealTimers();
        }
      }
      results.push({
        id: work.id,
        tokenId: work.tokenId,
        cases,
        transitions,
        watcherChecks,
        offset,
        types: Array.from(types),
        errors: Array.from(errors),
        notes: Array.from(notes),
        status: errors.size
          ? 'needs-repair'
          : notes.size
            ? 'needs-review'
            : 'timer-checks-passed',
      });
    }
    expect(results.length).toBeGreaterThan(0);
    const report = {
      generatedAt: new Date().toISOString(),
      scope:
        'Production timer/state selection and hourly live refresh. Does not test IPFS image decoding, current owner control values, or visual fidelity.',
      results,
    };
    writeFileSync(
      process.env.PROGRAMMABLE_RESULTS!,
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify({
        works: results.length,
        passed: results.filter((x) => x.status === 'timer-checks-passed')
          .length,
        review: results.filter((x) => x.status === 'needs-review').length,
        repair: results.filter((x) => x.status === 'needs-repair').length,
        cases: results.reduce((n, x) => n + x.cases, 0),
        watcherChecks: results.reduce((n, x) => n + x.watcherChecks, 0),
      }),
    );
  },
  240000,
);
