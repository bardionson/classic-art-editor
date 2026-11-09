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
  // Prefer the connected Vercel KV integration over legacy Upstash settings.
  // Select one complete pair; never mix credentials or switch stores on failure.
  const pairs = [
    {
      source: 'kv',
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    },
    {
      source: 'upstash',
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    },
  ];
  const config = pairs.find(({ url, token }) => url?.trim() && token?.trim());
  if (!config) {
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL)
      return null;
    return unavailable('configuration_missing');
  }
  const url = config.url!.trim();
  const token = config.token!.trim();
  try {
    const endpoint = new URL(url);
    if (
      endpoint.protocol !== 'https:' ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash ||
      !['', '/'].includes(endpoint.pathname) ||
      /[\s"']/.test(token)
    )
      return unavailable('configuration_invalid', config.source);
  } catch {
    return unavailable('configuration_invalid', config.source);
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
      return unavailable('invalid_response', config.source);
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
    return unavailable(classifyBudgetFailure(error), config.source);
  }
}

type BudgetFailure =
  | 'configuration_missing'
  | 'invalid_response'
  | 'timeout'
  | 'authentication_or_permissions'
  | 'connection_or_service'
  | 'configuration_invalid'
  | 'network_dns'
  | 'network_tls'
  | 'network_connect'
  | 'service_limit'
  | 'database_unavailable'
  | 'script_error'
  | 'counter_type'
  | 'service_response_invalid';

function classifyBudgetFailure(error: unknown): BudgetFailure {
  if (!(error instanceof Error)) return 'connection_or_service';
  // Upstash can append the full command; classify only the preceding message.
  const message = error.message.split(', command was:')[0];
  const cause = error.cause as { code?: unknown } | undefined;
  const code = typeof cause?.code === 'string' ? cause.code : '';
  if (
    ['TimeoutError', 'AbortError'].includes(error.name) ||
    [
      'ETIMEDOUT',
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_HEADERS_TIMEOUT',
    ].includes(code)
  )
    return 'timeout';
  if (['ENOTFOUND', 'EAI_AGAIN'].includes(code)) return 'network_dns';
  if (/CERT|TLS|SSL/.test(code)) return 'network_tls';
  if (
    ['ECONNREFUSED', 'ECONNRESET', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code)
  )
    return 'network_connect';
  if (
    /unauthori[sz]ed|wrongpass|noperm|invalid (token|password)|read.?only|no permission|not (allowed|authori[sz]ed)|authentication/i.test(
      message,
    )
  )
    return 'authentication_or_permissions';
  if (
    /quota|limit exceeded|exceeded.*limit|max.*(request|command|bandwidth)|too many requests/i.test(
      message,
    )
  )
    return 'service_limit';
  if (
    /database.*(not found|not exist|paused|disabled)|database is.*(unavailable|inactive)/i.test(
      message,
    )
  )
    return 'database_unavailable';
  if (/WRONGTYPE|not an integer/i.test(message)) return 'counter_type';
  if (
    /error (compiling|running) script|user_script|lua.*error|unknown.*command|CROSSSLOT/i.test(
      message,
    )
  )
    return 'script_error';
  if (error.name === 'UpstashJSONParseError' || error instanceof SyntaxError)
    return 'service_response_invalid';
  return 'connection_or_service';
}

function unavailable(reason: BudgetFailure, source?: string) {
  // Only this fixed enum is exposed; never environment values or error messages.
  console.error(
    'Alchemy request budget unavailable:',
    reason,
    source ?? 'none',
  );
  return NextResponse.json(
    {
      error: 'Chain reads temporarily unavailable. Please retry shortly.',
      code: `READ_BUDGET_${reason.toUpperCase()}`,
      ...(source ? { configuration: source } : {}),
    },
    {
      status: 503,
      headers: { 'Retry-After': '30', 'Cache-Control': 'no-store' },
    },
  );
}
