import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUDGET_SCRIPT, reserveAlchemyBudget } from '@/utils/alchemy-budget';

// Use the installed Redis SDK, mocking only the HTTP boundary. This catches
// constructor, serialization and response-shape mistakes that eval mocks miss.
describe('Alchemy budget Redis SDK transport', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://legacy-redis.invalid');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'legacy-secret');
    vi.stubEnv('KV_REST_API_URL', 'https://redis.invalid');
    vi.stubEnv('KV_REST_API_TOKEN', 'test-secret');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const req = new Request('https://example.invalid/api/rpc');
  it('sends the EVAL script and accepts a numeric zero through the real SDK', async () => {
    const fetcher = vi.fn(async (_url: unknown, init: RequestInit) => {
      const payload = JSON.parse(init.body as string);
      const command = Array.isArray(payload[0]) ? payload[0] : payload;
      expect(command.slice(0, 3)).toEqual(['eval', BUDGET_SCRIPT, 3]);
      expect(command.slice(6)).toEqual([1, 600, 6000, 200000, 60, 60, 86400]);
      return Response.json(
        Array.isArray(payload[0]) ? [{ result: 0 }] : { result: 0 },
      );
    });
    vi.stubGlobal('fetch', fetcher);
    expect(await reserveAlchemyBudget(req, 1)).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/redis\.invalid/);
    expect(new Headers(options.headers).get('authorization')).toBe(
      'Bearer test-secret',
    );
    expect(options.cache).toBe('no-store');
  });
  it('classifies a real SDK permission failure without exposing the response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            error:
              'ERR this token has no permission to execute this command private-response',
          },
          { status: 403 },
        ),
      ),
    );
    const response = await reserveAlchemyBudget(req, 1);
    expect(response?.status).toBe(503);
    const body = await response!.json();
    expect(body).toMatchObject({
      code: 'READ_BUDGET_AUTHENTICATION_OR_PERMISSIONS',
      configuration: 'kv',
    });
    expect(JSON.stringify(body)).not.toContain('private-response');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      'private-response',
    );
  });
});
