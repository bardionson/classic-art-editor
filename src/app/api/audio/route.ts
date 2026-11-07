import { NextRequest, NextResponse } from 'next/server';
import { allowedAudio, resolveR2Audio } from '@/utils/r2-audio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function resolve(request: NextRequest, importMissing: boolean) {
  const path = request.nextUrl.searchParams.get('path') ?? '';
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!allowedAudio(path))
    return NextResponse.json({ status: 'unknown' }, { status: 404, headers });
  try {
    const result = await resolveR2Audio(path, importMissing);
    return NextResponse.json(result, { headers });
  } catch (error) {
    // Never log signed URLs or credentials from SDK errors.
    console.warn(
      'Archive audio delivery unavailable',
      error instanceof Error ? error.name : 'Error',
    );
    return NextResponse.json(
      { status: 'unavailable' },
      { status: 503, headers },
    );
  }
}
export const GET = (request: NextRequest) => resolve(request, false);
export const POST = (request: NextRequest) => resolve(request, true);
