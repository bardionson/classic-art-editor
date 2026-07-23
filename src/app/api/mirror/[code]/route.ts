// src/app/api/mirror/[code]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  claimOrJoinMirrorSession,
  deleteMirrorSession,
  getMirrorSession,
  patchMirrorControlOverrides,
} from '@/utils/mirror-store';

export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  const { tokenAddress, tokenId } = await req.json();

  if (!tokenAddress || typeof tokenId !== 'number') {
    return NextResponse.json(
      { error: 'tokenAddress and tokenId are required' },
      { status: 400 },
    );
  }

  const { role, session } = await claimOrJoinMirrorSession(
    params.code,
    tokenAddress,
    tokenId,
  );

  if (role === 'display') {
    return NextResponse.json({ role });
  }

  return NextResponse.json({
    role,
    tokenAddress: session.tokenAddress,
    tokenId: session.tokenId,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  const role = req.nextUrl.searchParams.get('role');
  if (role !== 'display' && role !== 'control') {
    return NextResponse.json(
      { error: 'role query param must be "display" or "control"' },
      { status: 400 },
    );
  }

  const session = await getMirrorSession(params.code, role);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { code: string } },
) {
  const overrides = await req.json();

  const session = await patchMirrorControlOverrides(params.code, overrides);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { code: string } },
) {
  const deleted = await deleteMirrorSession(params.code);
  if (!deleted) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
