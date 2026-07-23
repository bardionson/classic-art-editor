// src/utils/mirror-store.ts
import { Redis } from '@upstash/redis';
import { Address } from 'viem';
import { MirrorRole, MirrorSession } from '@/types/mirror';

// Reads UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN from the environment.
const kv = Redis.fromEnv();

export const MIRROR_DISPLAY_STALE_MS = 20_000; // no display heartbeat in this long => code is up for grabs again
export const MIRROR_SESSION_TTL_SECONDS = 60 * 60; // sliding 1-hour expiry, refreshed on every touch

const keyFor = (code: string) => `mirror:${code.trim().toLowerCase()}`;

// Runs as a single Redis-side script so two near-simultaneous joins for the
// same code can't both become "display" or clobber each other's write.
// NOTE: cjson.encode({}) on a genuinely empty Lua table produces JSON `[]`,
// not `{}`, and there is no reliable way to tag a table as "definitely an
// object" for Redis's bundled cjson — it's the stock lua-cjson (Mark
// Pulford's), not the OpenResty/Kong fork, so neither the
// `setmetatable(t, { __jsontype = 'object' })` trick nor
// `cjson.encode_empty_table_as_object` (verified against the live Upstash
// instance: the metatable is silently ignored and the latter function
// doesn't exist here) has any effect — both still emit \`[]\`. So the empty
// case is special-cased with plain string formatting instead of cjson.
const CLAIM_OR_JOIN_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local staleMs = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local tokenAddress = ARGV[4]
local tokenId = tonumber(ARGV[5])

local function encodeOverrides(t)
  if next(t) == nil then
    return '{}'
  end
  return cjson.encode(t)
end

local existing = redis.call('GET', key)
local session

if existing then
  session = cjson.decode(existing)
end

if (not session) or (now - session.displayLastSeenAt > staleMs) then
  session = {
    tokenAddress = tokenAddress,
    tokenId = tokenId,
    controlOverrides = {},
    displayLastSeenAt = now,
    controlLastSeenAt = cjson.null,
  }
  local sessionJson = string.format(
    '{"tokenAddress":%s,"tokenId":%d,"controlOverrides":%s,"displayLastSeenAt":%d,"controlLastSeenAt":null}',
    cjson.encode(tokenAddress), tokenId, encodeOverrides(session.controlOverrides), now
  )
  redis.call('SET', key, sessionJson, 'EX', ttl)
  return {'display', sessionJson}
end

session.controlLastSeenAt = now
local sessionJson = string.format(
  '{"tokenAddress":%s,"tokenId":%d,"controlOverrides":%s,"displayLastSeenAt":%d,"controlLastSeenAt":%d}',
  cjson.encode(session.tokenAddress), session.tokenId, encodeOverrides(session.controlOverrides),
  session.displayLastSeenAt, session.controlLastSeenAt
)
redis.call('SET', key, sessionJson, 'EX', ttl)
return {'control', sessionJson}
`;

export async function claimOrJoinMirrorSession(
  code: string,
  tokenAddress: Address,
  tokenId: number,
): Promise<{ role: MirrorRole; session: MirrorSession }> {
  // The Redis client's automatic (default-on) deserialization recursively
  // JSON.parses any array element that looks like valid JSON, so the second
  // element — the Lua script's cjson-encoded session — usually arrives
  // already parsed into an object rather than as a raw string. Handle both
  // shapes rather than assuming it's always a string.
  const [role, rawSession] = (await kv.eval(
    CLAIM_OR_JOIN_SCRIPT,
    [keyFor(code)],
    [
      Date.now(),
      MIRROR_DISPLAY_STALE_MS,
      MIRROR_SESSION_TTL_SECONDS,
      tokenAddress,
      tokenId,
    ],
  )) as [MirrorRole, string | MirrorSession];

  const session =
    typeof rawSession === 'string' ? JSON.parse(rawSession) : rawSession;
  return { role, session };
}

export async function getMirrorSession(
  code: string,
  role: MirrorRole,
): Promise<MirrorSession | null> {
  const session = await kv.get<MirrorSession>(keyFor(code));
  if (!session) return null;

  const touched: MirrorSession = {
    ...session,
    ...(role === 'display'
      ? { displayLastSeenAt: Date.now() }
      : { controlLastSeenAt: Date.now() }),
  };
  await kv.set(keyFor(code), touched, { ex: MIRROR_SESSION_TTL_SECONDS });
  return touched;
}

export async function patchMirrorControlOverrides(
  code: string,
  overrides: Record<string, number>,
): Promise<MirrorSession | null> {
  const session = await kv.get<MirrorSession>(keyFor(code));
  if (!session) return null;

  const updated: MirrorSession = {
    ...session,
    controlOverrides: { ...session.controlOverrides, ...overrides },
    controlLastSeenAt: Date.now(),
  };
  await kv.set(keyFor(code), updated, { ex: MIRROR_SESSION_TTL_SECONDS });
  return updated;
}

export async function deleteMirrorSession(code: string): Promise<boolean> {
  const deletedCount = await kv.del(keyFor(code));
  return deletedCount > 0;
}
