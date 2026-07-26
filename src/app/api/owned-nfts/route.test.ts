import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

// Real wallet used to find and fix a bug where this route returned zero
// items for every wallet: Alchemy's getNFTsForOwner (with withMetadata=false)
// returns a flat `contractAddress` field per entry, not the nested
// `contract.address` shape the route originally assumed, so every entry was
// silently filtered out. Ground truth below was confirmed with a direct
// on-chain ownerOf() call against the V2 contract for each tokenId.
const TEST_WALLET = '0x01cB023186CAB05220554EE75b4D69921DD051f1';
const V2_CONTRACT = '0xb6dae651468e9593e4581705a09c10a76ac1e0c8';
const OWNED_TOKEN_IDS = ['483', '487', '488', '1181'];

const hasAlchemyKey = Boolean(process.env.ALCHEMY_KEY);

// This hits the real Alchemy NFT API, so it needs a real ALCHEMY_KEY in the
// environment. Skips (rather than failing) when one isn't present, matching
// this project's existing convention of no test runner/CI - this is meant to
// be run locally with a configured .env.local.
describe.skipIf(!hasAlchemyKey)('GET /api/owned-nfts', () => {
  it('returns exactly the known Async layers owned by the test wallet', async () => {
    const req = new NextRequest(
      `http://localhost/api/owned-nfts?address=${TEST_WALLET}`,
    );
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    const keys = body.items.map(
      (item: { contractAddress: string; tokenId: string }) =>
        `${item.contractAddress}-${item.tokenId}`,
    );

    for (const tokenId of OWNED_TOKEN_IDS) {
      expect(keys).toContain(`${V2_CONTRACT}-${tokenId}`);
    }

    // Regression guard for a real user-reported mixup: this wallet does NOT
    // own token 1178 (a different address does, confirmed on-chain) - a
    // naive "response is non-empty" assertion wouldn't catch the route
    // returning the wrong items, so assert the exact set instead.
    expect(keys).not.toContain(`${V2_CONTRACT}-1178`);
    expect(body.items).toHaveLength(OWNED_TOKEN_IDS.length);
  });

  it('returns 400 when the address query parameter is missing', async () => {
    const req = new NextRequest('http://localhost/api/owned-nfts');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed address', async () => {
    const req = new NextRequest(
      'http://localhost/api/owned-nfts?address=not-an-address',
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
