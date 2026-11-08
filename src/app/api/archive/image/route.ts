import { NextRequest, NextResponse } from 'next/server';
import { allowedArchiveImage, resolveR2Image } from '@/utils/r2-archive-images';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const headers = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
};
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') ?? '';
  if (!allowedArchiveImage(path))
    return new NextResponse(null, { status: 404, headers });
  try {
    const result =
      request.nextUrl.searchParams.get('original') === '1'
        ? await resolveR2Image(path, false, true)
        : await resolveR2Image(path);
    if (result.status === 'ready')
      return NextResponse.redirect(result.url, { status: 307, headers });
  } catch {
    /* Keep the exact original IPFS fallback available. */
  }
  return NextResponse.redirect('https://ipfs.filebase.io/ipfs/' + path, {
    status: 307,
    headers,
  });
}
export async function POST(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') ?? '';
  if (!allowedArchiveImage(path))
    return NextResponse.json({ status: 'unknown' }, { status: 404, headers });
  try {
    return NextResponse.json(await resolveR2Image(path, true), { headers });
  } catch {
    return NextResponse.json(
      { status: 'unavailable' },
      { status: 503, headers },
    );
  }
}
