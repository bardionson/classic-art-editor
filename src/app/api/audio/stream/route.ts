import { NextRequest, NextResponse } from 'next/server';
import { allowedAudio, resolveR2Audio } from '@/utils/r2-audio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') ?? '';
  if (!allowedAudio(path)) return new NextResponse(null, { status: 404 });
  let url = 'https://alchemy.mypinata.cloud/ipfs/' + path;
  try {
    const result = await resolveR2Audio(path);
    if (result.status === 'ready') url = result.url;
  } catch {
    /* Original IPFS fallback remains available. */
  }
  return NextResponse.redirect(url, {
    status: 307,
    headers: {
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
