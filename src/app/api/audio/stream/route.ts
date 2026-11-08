import { IPFS_PATH_GATEWAYS } from '@/utils/ipfs-gateways';
import { NextRequest, NextResponse } from 'next/server';
import { allowedAudio, resolveR2Audio } from '@/utils/r2-audio';

import {
  optimizedAudio,
  resolveOptimizedAudio,
} from '@/utils/r2-optimized-audio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') ?? '';
  if (!allowedAudio(path)) return new NextResponse(null, { status: 404 });
  // Small AAC listening copies retain the original timing and layer choices.
  // Original downloads continue to use /api/audio without this preference.
  if (optimizedAudio(path)) {
    try {
      const result = await resolveOptimizedAudio(path);
      if (result.status === 'ready') return redirect(result.url);
    } catch {
      /* Use the preserved original if the streaming copy is unavailable. */
    }
  }
  let url = IPFS_PATH_GATEWAYS[0] + path;
  try {
    const result = await resolveR2Audio(path);
    if (result.status === 'ready') url = result.url;
  } catch {
    /* Original IPFS fallback remains available. */
  }
  return redirect(url);
}
function redirect(url: string) {
  return NextResponse.redirect(url, {
    status: 307,
    headers: {
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
