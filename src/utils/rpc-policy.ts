import { toFunctionSelector } from 'viem';
import { V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS } from '@/config';

export const MAX_RPC_BYTES = 16_384;
export const MAX_RPC_BATCH = 20;
type RpcRequest = {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params: unknown[];
};
const contracts = new Set(
  [V1_CONTRACT_ADDRESS, V2_CONTRACT_ADDRESS]
    .filter(Boolean)
    .map((x) => x!.toLowerCase()),
);
const selectors = new Set(
  ['ownerOf(uint256)', 'tokenURI(uint256)', 'getControlToken(uint256)'].map(
    toFunctionSelector,
  ),
);
const record = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);

// This is the public artwork read transport, not a transaction relay. Wallet
// writes/simulation/receipts use wagmi's connected-wallet transport separately.
export function validateRpc(body: unknown): RpcRequest[] | null {
  const requests = Array.isArray(body) ? body : [body];
  if (!requests.length || requests.length > MAX_RPC_BATCH) return null;
  const result: RpcRequest[] = [];
  for (const r of requests) {
    if (
      !record(r) ||
      Object.keys(r).some(
        (k) => !['jsonrpc', 'id', 'method', 'params'].includes(k),
      ) ||
      r.jsonrpc !== '2.0'
    )
      return null;
    if (
      !(typeof r.id === 'string' && r.id.length <= 64) &&
      !(typeof r.id === 'number' && Number.isSafeInteger(r.id))
    )
      return null;
    const params = r.params ?? [];
    if (!Array.isArray(params)) return null;
    if (r.method === 'eth_chainId' || r.method === 'eth_blockNumber') {
      if (params.length) return null;
    } else if (r.method === 'eth_call') {
      if (params.length !== 2 || params[1] !== 'latest' || !record(params[0]))
        return null;
      const call = params[0];
      if (Object.keys(call).some((k) => !['to', 'data'].includes(k)))
        return null;
      if (typeof call.to !== 'string' || !contracts.has(call.to.toLowerCase()))
        return null;
      // Exactly a selector and one uint256: excludes arbitrary calldata,
      // state overrides, multicalls, approvals and all write functions.
      if (
        typeof call.data !== 'string' ||
        !/^0x[0-9a-fA-F]{72}$/.test(call.data) ||
        !selectors.has(call.data.slice(0, 10).toLowerCase() as `0x${string}`)
      )
        return null;
    } else return null;
    result.push({
      jsonrpc: '2.0',
      id: r.id as string | number,
      method: r.method,
      params,
    });
  }
  return result;
}

export class RpcInputError extends Error {
  constructor(public status: number) {
    super('Invalid RPC request');
  }
}

export async function readRpcBody(req: Request): Promise<unknown> {
  if (
    req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !==
    'application/json'
  )
    throw new RpcInputError(415);
  if (Number(req.headers.get('content-length')) > MAX_RPC_BYTES)
    throw new RpcInputError(413);
  const reader = req.body?.getReader();
  if (!reader) throw new RpcInputError(400);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void reader.cancel();
      reject(new RpcInputError(408));
    }, 5000);
  });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RPC_BYTES) {
        void reader.cancel();
        throw new RpcInputError(413);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    throw error instanceof RpcInputError ? error : new RpcInputError(400);
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
