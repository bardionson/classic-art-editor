import { beforeEach, afterEach, it, expect, vi } from 'vitest';
vi.mock('@aws-sdk/client-s3', () => ({
  HeadObjectCommand: class {
    kind = 'head';
    constructor(public input: any) {}
  },
  PutObjectCommand: class {
    kind = 'put';
    constructor(public input: any) {}
  },
}));
import type { S3Client } from '@aws-sdk/client-s3';
import { acquireR2Import } from './r2-import-limit';
let now = 1_000_000;
beforeEach(() => {
  now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});
afterEach(() => vi.restoreAllMocks());
function storage() {
  const objects = new Map<
    string,
    { ETag: string; Metadata: Record<string, string> }
  >();
  const bodies = new Set<string>();
  let sequence = 0;
  const fail = (n: number) => {
    throw { $metadata: { httpStatusCode: n } };
  };
  const send = vi.fn(async (command: any) => {
    const input = command.input;
    const old = objects.get(input.Key);
    if (command.kind === 'head') {
      if (!old) return fail(404);
      return { ...old };
    }
    if (input.IfNoneMatch === '*' && old) return fail(412);
    if (input.IfMatch && old?.ETag !== input.IfMatch) return fail(412);
    expect(bodies.has(input.Body)).toBe(false);
    bodies.add(input.Body);
    const object = { ETag: `"${++sequence}"`, Metadata: input.Metadata };
    objects.set(input.Key, object);
    return object;
  });
  return { client: { send } as unknown as S3Client, objects, send };
}
it('permits at most two simultaneous imports across independent callers', async () => {
  const { client } = storage();
  const releases = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      acquireR2Import(
        client,
        'bucket',
        `audio-${i}`,
        new AbortController().signal,
      ),
    ),
  );
  expect(releases.filter(Boolean)).toHaveLength(2);
  await Promise.all(releases.map((release) => release?.()));
  expect(
    await acquireR2Import(
      client,
      'bucket',
      'another',
      new AbortController().signal,
    ),
  ).toBeTypeOf('function');
});
it('prevents duplicate retries during cooldown and permits recovery after expiration', async () => {
  const { client } = storage();
  const release = await acquireR2Import(
    client,
    'bucket',
    'audio',
    new AbortController().signal,
  );
  await release!();
  expect(
    await acquireR2Import(
      client,
      'bucket',
      'audio',
      new AbortController().signal,
    ),
  ).toBeNull();
  now += 121000;
  expect(
    await acquireR2Import(
      client,
      'bucket',
      'audio',
      new AbortController().signal,
    ),
  ).toBeTypeOf('function');
});
it('does not let an expired worker release a newer worker’s slot', async () => {
  const { client, objects } = storage();
  const old = await acquireR2Import(
    client,
    'bucket',
    'old',
    new AbortController().signal,
  );
  now += 66000;
  const current = await acquireR2Import(
    client,
    'bucket',
    'new',
    new AbortController().signal,
  );
  const etag = objects.get('archive-audio/control/v1/slot-0')!.ETag;
  await old!();
  expect(objects.get('archive-audio/control/v1/slot-0')!.ETag).toBe(etag);
  expect(current).toBeTypeOf('function');
});
it('honors the hourly budget and releases the slot after refusing an import', async () => {
  const { client, objects } = storage();
  objects.set('archive-audio/control/v1/budget', {
    ETag: '"budget"',
    Metadata: { control: 'v1', until: '3600000', value: '120' },
  });
  expect(
    await acquireR2Import(
      client,
      'bucket',
      'audio',
      new AbortController().signal,
    ),
  ).toBeNull();
  expect(objects.get('archive-audio/control/v1/slot-0')?.Metadata.until).toBe(
    '0',
  );
  now = 3600001;
  expect(
    await acquireR2Import(
      client,
      'bucket',
      'audio',
      new AbortController().signal,
    ),
  ).toBeTypeOf('function');
});
it('fails closed on permissions errors rather than importing without a limiter', async () => {
  const client = {
    send: vi.fn(async () => {
      throw { $metadata: { httpStatusCode: 403 } };
    }),
  } as unknown as S3Client;
  await expect(
    acquireR2Import(client, 'bucket', 'audio', new AbortController().signal),
  ).rejects.toBeDefined();
});
