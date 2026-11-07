import { NextRequest, NextResponse } from 'next/server';
import {
  optimizedAudio,
  readStreamingCopy,
  resolveOptimizedAudio,
} from '@/utils/r2-optimized-audio';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const headers = { 'Cache-Control': 'private, no-store' };
async function resolve(request: NextRequest, upload: boolean) {
  const path = request.nextUrl.searchParams.get('path') ?? '';
  if (!optimizedAudio(path))
    return NextResponse.json({ status: 'unknown' }, { status: 404, headers });
  let body: Uint8Array | undefined;
  if (upload) {
    try {
      body = await readStreamingCopy(request, path);
    } catch {
      return NextResponse.json({ status: 'invalid' }, { status: 400, headers });
    }
  }
  try {
    return NextResponse.json(await resolveOptimizedAudio(path, body), {
      headers,
    });
  } catch {
    return NextResponse.json(
      { status: 'unavailable' },
      { status: 503, headers },
    );
  }
}
export const GET = (request: NextRequest) => resolve(request, false);
export const POST = (request: NextRequest) => resolve(request, true);
