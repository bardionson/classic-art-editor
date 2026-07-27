import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { mainnet } from 'viem/chains';

// Ensure this environment variable is set
const ALCHEMY_KEY = process.env.ALCHEMY_KEY;

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');

  if (!address || !ADDRESS_REGEX.test(address)) {
    return NextResponse.json(
      { error: 'Missing or invalid "address" query parameter' },
      { status: 400 },
    );
  }

  if (!ALCHEMY_KEY) {
    console.error('Missing ALCHEMY_KEY in server environment variables.');
    return NextResponse.json(
      { error: 'Server configuration error: Missing ALCHEMY_KEY' },
      { status: 500 },
    );
  }

  try {
    // ENS only exists on mainnet, regardless of which network this app is
    // otherwise active on (e.g. Goerli in dev/preview) - always resolve
    // against mainnet here rather than reusing the ACTIVE_NETWORK-locked
    // /api/rpc proxy.
    const client = createPublicClient({
      chain: mainnet,
      transport: http(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`),
    });

    const ensName = await client.getEnsName({
      address: address as `0x${string}`,
    });

    return NextResponse.json({ ensName });
  } catch (error: any) {
    // Log server-side only - same reasoning as the other Alchemy-backed
    // routes in this app: don't forward error details that could embed the
    // request URL (which contains the Alchemy key) to the client.
    console.error('ENS Lookup Error:', error);
    return NextResponse.json({ ensName: null });
  }
}
