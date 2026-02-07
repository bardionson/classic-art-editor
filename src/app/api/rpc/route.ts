import { NextRequest, NextResponse } from 'next/server';
import { ACTIVE_NETWORK } from '@/config';

// Ensure this environment variable is set
const ALCHEMY_KEY = process.env.ALCHEMY_KEY;

export async function POST(req: NextRequest) {
  // We can't use ACTIVE_NETWORK directly here because it relies on NEXT_PUBLIC_ACTIVE_NETWORK
  // being available at runtime, which it should be.
  // But let's double check if we need to guard against undefined.
  if (!ALCHEMY_KEY) {
      console.error('Missing ALCHEMY_KEY in server environment variables.');
      return NextResponse.json(
        { error: 'Server configuration error: Missing ALCHEMY_KEY' },
        { status: 500 }
      );
  }

  try {
    const body = await req.json();

    // Determine the Alchemy URL based on the active network
    // ACTIVE_NETWORK: 1 = Mainnet, 5 = Goerli
    // Default to mainnet if undefined to be safe, but log a warning if needed
    const network = ACTIVE_NETWORK === 5 ? 'eth-goerli' : 'eth-mainnet';
    const alchemyUrl = `https://${network}.g.alchemy.com/v2/${ALCHEMY_KEY}`;

    const response = await fetch(alchemyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Alchemy API Error: ${response.status} ${response.statusText} - ${errorText}`);
      return NextResponse.json(
        { error: `Alchemy Error: ${response.statusText}`, details: errorText },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('RPC Proxy Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 },
    );
  }
}
