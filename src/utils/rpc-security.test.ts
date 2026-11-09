import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { encodeFunctionData, parseAbi } from 'viem';
import { V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS } from '@/config';
import { MAX_RPC_BYTES, readRpcBody, validateRpc } from '@/utils/rpc-policy';
const budget = vi.hoisted(() => vi.fn());
vi.mock('@/utils/alchemy-budget', () => ({ reserveAlchemyBudget: budget }));
import { POST } from '@/app/api/rpc/route';

const read = (fn = 'ownerOf', to = V2_CONTRACT_ADDRESS) => ({
  jsonrpc: '2.0',
  id: 12,
  method: 'eth_call',
  params: [
    {
      to,
      data: encodeFunctionData({
        abi: parseAbi([`function ${fn}(uint256) view returns (uint256)`]),
        functionName: fn,
        args: [BigInt(1605)],
      }),
    },
    'latest',
  ],
});
const request = (body: unknown) =>
  new NextRequest('https://www.async.art/api/rpc', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('archive RPC boundary', () => {
  beforeEach(() => {
    vi.stubEnv('ALCHEMY_KEY', 'private-test-key');
    budget.mockReset().mockResolvedValue(null);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it('accepts original v1/v2 ownership, URI and layer reads encoded by viem', () => {
    for (const to of [V1_CONTRACT_ADDRESS!, V2_CONTRACT_ADDRESS])
      for (const fn of ['ownerOf', 'tokenURI', 'getControlToken'])
        expect(validateRpc(read(fn, to))).not.toBeNull();
  });
  it.each([
    'eth_sendRawTransaction',
    'eth_sendTransaction',
    'eth_getLogs',
    'debug_traceCall',
    'alchemy_getTokenBalances',
    'eth_estimateGas',
    'personal_sign',
  ])('rejects %s before contacting Alchemy', async (method) => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(
      (await POST(request({ jsonrpc: '2.0', id: 1, method, params: [] })))
        .status,
    ).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
    expect(budget).not.toHaveBeenCalled();
  });
  it('rejects other contracts, writes, overrides and historical/unbounded reads', () => {
    expect(
      validateRpc(
        read('ownerOf', '0x0000000000000000000000000000000000000001'),
      ),
    ).toBeNull();
    expect(validateRpc(read('approve'))).toBeNull();
    expect(
      validateRpc({ ...read(), params: [...read().params, {}] }),
    ).toBeNull();
    expect(
      validateRpc({ ...read(), params: [read().params[0], '0x1'] }),
    ).toBeNull();
    expect(
      validateRpc({
        ...read(),
        params: [{ ...(read().params[0] as object), value: '0x1' }, 'latest'],
      }),
    ).toBeNull();
    expect(validateRpc([])).toBeNull();
    expect(validateRpc(Array(21).fill(read()))).toBeNull();
    expect(validateRpc({ ...read(), id: {} })).toBeNull();
  });
  it('bounds streamed bodies without relying on Content-Length', async () => {
    const req = request({ value: 'x'.repeat(MAX_RPC_BYTES) });
    await expect(readRpcBody(req)).rejects.toMatchObject({ status: 413 });
    await expect(
      readRpcBody(
        new Request('https://example.com', { method: 'POST', body: '{}' }),
      ),
    ).rejects.toMatchObject({ status: 415 });
  });
  it('preserves batch ids and charges each call', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json([
          { jsonrpc: '2.0', id: 2, result: '0x2' },
          { jsonrpc: '2.0', id: 12, result: '0x1' },
        ]),
      ),
    );
    const result = await POST(request([read(), { ...read(), id: 2 }]));
    expect(await result.json()).toEqual([
      { jsonrpc: '2.0', id: 12, result: '0x1' },
      { jsonrpc: '2.0', id: 2, result: '0x2' },
    ]);
    expect(budget.mock.calls[0][1]).toBe(2);
  });
  it('does not make upstream requests when the budget fails closed', async () => {
    budget.mockResolvedValue(
      Response.json({ error: 'limited' }, { status: 429 }),
    );
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect((await POST(request(read()))).status).toBe(429);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('scrubs JSON-RPC and HTTP error bodies', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          id: 12,
          error: {
            code: -32000,
            message: 'https://provider/private-test-key',
            data: 'private-test-key',
          },
        }),
      )
      .mockResolvedValueOnce(new Response('private-test-key', { status: 500 }));
    vi.stubGlobal('fetch', fetcher);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const first = await POST(request(read()));
    expect(await first.text()).not.toContain('private-test-key');
    const second = await POST(request(read()));
    expect(second.status).toBe(502);
    expect(await second.text()).not.toContain('private-test-key');
  });
});
