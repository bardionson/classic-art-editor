import { NextRequest, NextResponse } from 'next/server';
import { getArchiveRecordByCid } from '@/utils/archive-search';
import {
  IPFS_CID,
  metadataImage,
  metadataPlayback,
  MEDIA_GATEWAYS,
} from '@/utils/archive-media';

export const maxDuration = 30;
const MAX_BYTES = 2_000_000;
export async function GET(request: NextRequest) {
  const cid = request.nextUrl.searchParams.get('cid') ?? '';
  // Fixed gateway hosts and indexed CIDs only: this is not an arbitrary URL proxy.
  if (!IPFS_CID.test(cid) || !getArchiveRecordByCid(cid)) {
    return NextResponse.json(
      { error: 'Unknown archive metadata' },
      { status: 404 },
    );
  }
  const record = getArchiveRecordByCid(cid)!;
  const music = record.family === 'music-blueprints';
  const preserved = music
    ? metadataPlayback({ animation_url: record.animationUrl })
    : null;
  if (preserved) {
    return NextResponse.json({ image: record.image ?? null, media: preserved });
  }
  for (const gateway of MEDIA_GATEWAYS) {
    try {
      const response = await fetch(gateway + cid, {
        signal: AbortSignal.timeout(7000),
        redirect: 'error',
        next: { revalidate: 86400 },
      });
      if (!response.ok || !response.body) continue;
      const reader = response.body.getReader();
      let size = 0;
      const chunks: Uint8Array[] = [];
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_BYTES) throw new Error('Metadata too large');
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
      return NextResponse.json(
        {
          image: metadataImage(data),
          ...(music ? { media: metadataPlayback(data) } : {}),
        },
        {
          headers: {
            'Cache-Control':
              'public, s-maxage=86400, stale-while-revalidate=604800',
          },
        },
      );
    } catch {
      /* Try the next original-content gateway, never invent metadata. */
    }
  }
  return NextResponse.json(
    { image: null, error: 'Metadata temporarily unavailable' },
    {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
