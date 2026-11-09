import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { evaluate, construct } = vi.hoisted(() => ({
  evaluate: vi.fn(),
  construct: vi.fn(),
}));
vi.mock('@upstash/redis', () => ({
  Redis: class {
    constructor(config: unknown) {
      construct(config);
    }
    eval = evaluate;
  },
}));
import { reserveAlchemyBudget } from '@/utils/alchemy-budget';
const request = new Request('https://www.async.art/api/rpc', {
  headers: {
    'x-vercel-forwarded-for': '192.0.2.1',
    'x-forwarded-for': 'spoofed',
  },
});
describe('shared Alchemy budget', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.invalid');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'secret');
    evaluate.mockReset().mockResolvedValue(0);
    construct.mockReset();
    vi.stubEnv('KV_REST_API_URL', '');
    vi.stubEnv('KV_REST_API_TOKEN', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  it('charges batch weight against IP, global minute and daily budgets atomically', async () => {
    expect(await reserveAlchemyBudget(request, 20)).toBeNull();
    const [, keys, args] = evaluate.mock.calls[0];
    expect(keys).toHaveLength(3);
    expect(args).toEqual([20, 600, 6000, 200000, 60, 60, 86400]);
    expect(keys.join()).not.toContain('192.0.2.1');
    await reserveAlchemyBudget(
      new Request(request.url, {
        headers: {
          'x-vercel-forwarded-for': '192.0.2.1',
          'x-forwarded-for': 'different-spoof',
        },
      }),
      1,
    );
    expect(evaluate.mock.calls[1][1]).toEqual(keys);
  });
  it('returns Retry-After when capped', async () => {
    evaluate.mockResolvedValue(42);
    const response = await reserveAlchemyBudget(request, 1);
    expect(response?.status).toBe(429);
    expect(response?.headers.get('retry-after')).toBe('42');
  });
  it('fails closed on Redis outage and missing production configuration', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    evaluate.mockRejectedValue(new Error('secret'));
    expect((await reserveAlchemyBudget(request, 1))?.status).toBe(503);
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('KV_REST_API_URL', '');
    expect((await reserveAlchemyBudget(request, 1))?.status).toBe(503);
  });
  it.each([
    [new DOMException('private-url', 'TimeoutError'), 'TIMEOUT'],
    [new Error('WRONGPASS private-token'), 'AUTHENTICATION_OR_PERMISSIONS'],
    [new Error('fetch failed private-url'), 'CONNECTION_OR_SERVICE'],
    [
      new Error('fetch failed private-url', { cause: { code: 'ENOTFOUND' } }),
      'NETWORK_DNS',
    ],
    [
      new Error('fetch failed private-url', {
        cause: { code: 'CERT_HAS_EXPIRED' },
      }),
      'NETWORK_TLS',
    ],
    [
      new Error('ERR this token has no permissions private-token'),
      'AUTHENTICATION_OR_PERMISSIONS',
    ],
    [new Error('ERR max requests limit exceeded private-url'), 'SERVICE_LIMIT'],
    [new Error('ERR database is paused private-url'), 'DATABASE_UNAVAILABLE'],
    [new Error('ERR Error running script private-url'), 'SCRIPT_ERROR'],
    [new Error('WRONGTYPE private-url'), 'COUNTER_TYPE'],
    [new SyntaxError('private-response'), 'SERVICE_RESPONSE_INVALID'],
  ])('reports only a safe category for %s', async (error, code) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    evaluate.mockRejectedValue(error);
    const response = await reserveAlchemyBudget(request, 1);
    expect(response?.status).toBe(503);
    const body = await response!.json();
    expect(body.code).toBe(`READ_BUDGET_${code}`);
    expect(JSON.stringify(body)).not.toContain('private-');
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-');
  });
  it('distinguishes missing configuration from an unexpected Redis result', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    evaluate.mockResolvedValue(null);
    expect(
      await (await reserveAlchemyBudget(request, 1))!.json(),
    ).toMatchObject({
      code: 'READ_BUDGET_INVALID_RESPONSE',
    });
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('KV_REST_API_URL', '');
    expect(
      await (await reserveAlchemyBudget(request, 1))!.json(),
    ).toMatchObject({
      code: 'READ_BUDGET_CONFIGURATION_MISSING',
    });
  });
  it('accepts the Vercel KV aliases without Upstash-named variables', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('KV_REST_API_URL', 'https://redis.invalid');
    vi.stubEnv('KV_REST_API_TOKEN', 'secret');
    expect(await reserveAlchemyBudget(request, 1)).toBeNull();
    expect(evaluate).toHaveBeenCalledOnce();
  });
  it('uses a complete KV pair when the Upstash pair is incomplete', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('KV_REST_API_URL', 'https://kv.invalid');
    vi.stubEnv('KV_REST_API_TOKEN', 'kv-secret');
    expect(await reserveAlchemyBudget(request, 1)).toBeNull();
    expect(construct).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://kv.invalid',
        token: 'kv-secret',
      }),
    );
  });
  it('does not combine two incomplete pairs', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
    vi.stubEnv('KV_REST_API_TOKEN', 'kv-secret');
    const response = await reserveAlchemyBudget(request, 1);
    expect((await response!.json()).code).toBe(
      'READ_BUDGET_CONFIGURATION_MISSING',
    );
    expect(construct).not.toHaveBeenCalled();
  });
  it.each([
    'redis://private-host',
    '"https://private-host"',
    'https://private-host/path',
  ])('rejects malformed REST URLs without exposing them', async (url) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('UPSTASH_REDIS_REST_URL', url);
    const response = await reserveAlchemyBudget(request, 1);
    const body = await response!.json();
    expect(body.code).toBe('READ_BUDGET_CONFIGURATION_INVALID');
    expect(JSON.stringify(body)).not.toContain('private-host');
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-host');
    expect(evaluate).not.toHaveBeenCalled();
  });
  it('prefers Vercel KV when both complete pairs exist', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.invalid');
    vi.stubEnv('KV_REST_API_TOKEN', 'kv-secret');
    expect(await reserveAlchemyBudget(request, 1)).toBeNull();
    expect(construct).toHaveBeenCalledOnce();
    expect(construct).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://kv.invalid',
        token: 'kv-secret',
      }),
    );
  });
  it('does not bypass the chosen KV budget by trying another store after failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('KV_REST_API_URL', 'https://kv.invalid');
    vi.stubEnv('KV_REST_API_TOKEN', 'kv-secret');
    evaluate.mockRejectedValue(
      new Error('fetch failed', { cause: { code: 'ENOTFOUND' } }),
    );
    const response = await reserveAlchemyBudget(request, 1);
    expect(response?.status).toBe(503);
    expect(await response!.json()).toMatchObject({
      code: 'READ_BUDGET_NETWORK_DNS',
      configuration: 'kv',
    });
    expect(construct).toHaveBeenCalledOnce();
    expect(evaluate).toHaveBeenCalledOnce();
  });
});
