import { NextResponse } from 'next/server';
import { getMarketReport } from '@/utils/artwork-market-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;
export async function GET() {
  try {
    return NextResponse.json(await getMarketReport(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          'Fresh price data is unavailable. No artwork update was calculated. Please retry shortly.',
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
      },
    );
  }
}
