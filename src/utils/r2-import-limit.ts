import { createHash, randomUUID } from 'node:crypto';
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

type State = { until: number; value: number };
const PREFIX = 'archive-audio/control/v1/';
const code = (error: unknown) =>
  (error as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode;

// R2 evaluates If-Match/If-None-Match atomically. Include a nonce in the BODY:
// changing metadata alone would retain the ETag and would not provide a lock.
async function replace(
  client: S3Client,
  bucket: string,
  key: string,
  state: State,
  etag?: string,
  signal?: AbortSignal,
) {
  return client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify({ ...state, nonce: randomUUID() }),
      ContentType: 'application/json',
      CacheControl: 'no-store',
      Metadata: {
        control: 'v1',
        until: String(state.until),
        value: String(state.value),
      },
      ...(etag ? { IfMatch: etag } : { IfNoneMatch: '*' }),
    }),
    {
      abortSignal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(5000)])
        : AbortSignal.timeout(5000),
    },
  );
}

async function update(
  client: S3Client,
  bucket: string,
  name: string,
  decide: (state: State | null) => State | null,
  signal: AbortSignal,
) {
  const key = PREFIX + name;
  for (let attempt = 0; attempt < 3; attempt++) {
    let etag: string | undefined;
    let state: State | null = null;
    try {
      const head = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: key }),
        { abortSignal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) },
      );
      if (head.Metadata?.control !== 'v1' || !head.ETag)
        throw new Error('Unknown import control object');
      state = {
        until: Number(head.Metadata.until),
        value: Number(head.Metadata.value),
      };
      if (!Number.isFinite(state.until) || !Number.isFinite(state.value))
        throw new Error('Invalid import control object');
      etag = head.ETag;
    } catch (error) {
      if (code(error) !== 404) throw error;
    }
    const next = decide(state);
    if (!next) return null;
    try {
      const result = await replace(client, bucket, key, next, etag, signal);
      if (!result.ETag) throw new Error('Missing import control ETag');
      return { key, etag: result.ETag };
    } catch (error) {
      if (code(error) !== 412 && code(error) !== 409) throw error;
    }
  }
  return null;
}

export async function acquireR2Import(
  client: S3Client,
  bucket: string,
  path: string,
  signal: AbortSignal,
): Promise<(() => Promise<void>) | null> {
  const now = Date.now();
  const lease = (state: State | null) =>
    state && state.until > now ? null : { until: now + 65000, value: 1 };
  const slot =
    (await update(client, bucket, 'slot-0', lease, signal)) ??
    (await update(client, bucket, 'slot-1', lease, signal));
  if (!slot) return null;
  const release = async () => {
    try {
      await replace(
        client,
        bucket,
        slot.key,
        { until: 0, value: 0 },
        slot.etag,
      );
    } catch (error) {
      if (code(error) !== 412 && code(error) !== 409) throw error;
    }
  };
  let acquired = false;
  try {
    const cooldown = await update(
      client,
      bucket,
      'attempt-' + createHash('sha256').update(path).digest('hex'),
      (state) =>
        state && state.until > now ? null : { until: now + 120000, value: 1 },
      signal,
    );
    if (!cooldown) return null;
    const budget = await update(
      client,
      bucket,
      'budget',
      (state) => {
        const count = state && state.until > now ? state.value : 0;
        if (count >= 120) return null;
        return {
          until: (Math.floor(now / 3600000) + 1) * 3600000,
          value: count + 1,
        };
      },
      signal,
    );
    if (!budget) return null;
    acquired = true;
    return release;
  } finally {
    if (!acquired) await release().catch(() => undefined);
  }
}
