import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const evaluate = vi.hoisted(() => vi.fn());
vi.mock('@upstash/redis', () => ({
  Redis: class {
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
});
