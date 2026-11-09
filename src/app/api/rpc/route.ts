import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_NETWORK } from '@/config';
import { readRpcBody, RpcInputError, validateRpc } from '@/utils/rpc-policy';
import { reserveAlchemyBudget } from '@/utils/alchemy-budget';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await readRpcBody(req);
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid RPC request' },
      { status: error instanceof RpcInputError ? error.status : 400 },
    );
  }
  const calls = validateRpc(body);
  if (!calls)
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32600,
          message: 'Only supported archive reads are allowed',
        },
      },
      { status: 400 },
    );
  const key = process.env.ALCHEMY_KEY;
  if (!key)
    return NextResponse.json(
      { error: 'Chain reads unavailable' },
      { status: 503 },
    );
  const limited = await reserveAlchemyBudget(req, calls.length);
  if (limited) return limited;
  try {
    const network = ACTIVE_NETWORK === 5 ? 'eth-goerli' : 'eth-mainnet';
    const response = await fetch(`https://${network}.g.alchemy.com/v2/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Array.isArray(body) ? calls : calls[0]),
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error('Upstream unavailable');
    const data = await response.json();
    const entries = Array.isArray(body) ? data : [data];
    if (!Array.isArray(entries) || entries.length !== calls.length)
      throw new Error('Invalid upstream response');
    const results = calls.map((call) => {
      const entry = entries.find((x) => x?.id === call.id);
      if (!entry) throw new Error('Missing upstream response');
      // Preserve JSON-RPC failure semantics without echoing provider messages,
      // error.data, URLs or exception details into the browser.
      return entry.error || !Object.hasOwn(entry, 'result')
        ? {
            jsonrpc: '2.0',
            id: call.id,
            error: { code: -32000, message: 'Contract read failed' },
          }
        : { jsonrpc: '2.0', id: call.id, result: entry.result };
    });
    return NextResponse.json(Array.isArray(body) ? results : results[0], {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    console.error('Archive RPC upstream request failed');
    return NextResponse.json(
      { error: 'Chain reads temporarily unavailable' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
