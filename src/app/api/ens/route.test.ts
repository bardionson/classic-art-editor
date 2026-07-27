import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

// vitalik.eth's known address - stable, well-known ENS reverse record, good
// ground truth for confirming resolution actually works end-to-end.
const VITALIK_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

const hasAlchemyKey = Boolean(process.env.ALCHEMY_KEY);

// Hits the real Alchemy-backed mainnet RPC, so needs a real ALCHEMY_KEY in
// the environment - skips (rather than failing) when one isn't present,
// matching this project's existing test convention (see api/owned-nfts).
describe.skipIf(!hasAlchemyKey)('GET /api/ens', () => {
  it('resolves a known address to its ENS name', async () => {
    const req = new NextRequest(
      `http://localhost/api/ens?address=${VITALIK_ADDRESS}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ensName).toBe('vitalik.eth');
  });

  it('returns null ensName for an address with no ENS reverse record', async () => {
    // The well-known "burn address" - extremely unlikely to have an ENS
    // reverse record set.
    const req = new NextRequest(
      'http://localhost/api/ens?address=0x000000000000000000000000000000000000dEaD',
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ensName).toBeNull();
  });

  it('returns 400 for a missing address', async () => {
    const req = new NextRequest('http://localhost/api/ens');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed address', async () => {
    const req = new NextRequest(
      'http://localhost/api/ens?address=not-an-address',
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
