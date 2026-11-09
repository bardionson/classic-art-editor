import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// Atomic across Vercel regions/instances. A rejected request does not consume
// the global budget. Expiry is set in the same Lua operation as incrementing.
export const BUDGET_SCRIPT = `
for i = 1, #KEYS do
  local count = tonumber(redis.call('GET', KEYS[i]) or '0')
  if count + tonumber(ARGV[1]) > tonumber(ARGV[i + 1]) then
    return math.max(1, redis.call('TTL', KEYS[i]))
  end
end
for i = 1, #KEYS do
  local count = redis.call('INCRBY', KEYS[i], ARGV[1])
  if count == tonumber(ARGV[1]) then
    redis.call('EXPIRE', KEYS[i], tonumber(ARGV[#KEYS + i + 1]))
  end
end
return 0
`;

function limit(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export async function reserveAlchemyBudget(
  req: Request,
  cost: number,
): Promise<NextResponse | null> {
  if (!Number.isSafeInteger(cost) || cost < 1 || cost > 100)
    throw new Error('Invalid budget cost');
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    // Local development can run without Redis; every deployed production or
    // preview instance must have shared limits. Never fall back to per-instance
    // memory on Vercel (a cold start would silently reset the quota).
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL)
      return null;
    return unavailable('configuration_missing');
  }
  // Trust Vercel's protected edge header, not a client-selected address/header.
  // Off Vercel all clients share one bucket until a trusted proxy is configured.
  const ip = process.env.VERCEL
    ? req.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ||
      'unknown'
    : 'local';
  const identity = createHash('sha256').update(ip).digest('hex').slice(0, 32);
  const prefix = 'archive:{alchemy-budget}';
  try {
    const redis = new Redis({
      url,
      token,
      retry: { retries: 0 },
      signal: () => AbortSignal.timeout(3000),
    });
    const retryAfter = await redis.eval(
      BUDGET_SCRIPT,
      [`${prefix}:ip:${identity}`, `${prefix}:minute`, `${prefix}:day`],
      [
        cost,
        limit('ALCHEMY_IP_BUDGET_PER_MINUTE', 600),
        limit('ALCHEMY_GLOBAL_BUDGET_PER_MINUTE', 6000),
        limit('ALCHEMY_GLOBAL_BUDGET_PER_DAY', 200000),
        60,
        60,
        86400,
      ],
    );
    if (
      typeof retryAfter !== 'number' ||
      !Number.isFinite(retryAfter) ||
      retryAfter < 0
    )
      return unavailable('invalid_response');
    if (retryAfter > 0)
      return NextResponse.json(
        { error: 'Request limit reached. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'Cache-Control': 'no-store',
          },
        },
      );
    return null;
  } catch (error) {
    // Classify locally, but never echo/log upstream messages or credentials.
    const message = error instanceof Error ? error.message : '';
    const reason =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
        ? 'timeout'
        : /unauthorized|wrongpass|noperm|invalid token|read.?only/i.test(
              message,
            )
          ? 'authentication_or_permissions'
          : 'connection_or_service';
    return unavailable(reason);
  }
}

type BudgetFailure =
  | 'configuration_missing'
  | 'invalid_response'
  | 'timeout'
  | 'authentication_or_permissions'
  | 'connection_or_service';

function unavailable(reason: BudgetFailure) {
  // Only this fixed enum is exposed; never environment values or error messages.
  console.error('Alchemy request budget unavailable:', reason);
  return NextResponse.json(
    {
      error: 'Chain reads temporarily unavailable. Please retry shortly.',
      code: `READ_BUDGET_${reason.toUpperCase()}`,
    },
    {
      status: 503,
      headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' },
    },
  );
}
