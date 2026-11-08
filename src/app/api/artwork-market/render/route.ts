import { NextRequest, NextResponse } from 'next/server';
import { getHourlyArtwork } from '@/utils/artwork-hourly-server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('tokenId');
  if (id !== '807' && id !== '245')
    return NextResponse.json({ error: 'Unsupported artwork' }, { status: 400 });
  try {
    return NextResponse.json(await getHourlyArtwork(Number(id) as 807 | 245), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          'Hourly update unavailable. Showing recorded settings until it recovers.',
      },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
      },
    );
  }
}
