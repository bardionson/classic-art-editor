# Mirror Display/Control Feature Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one device show an artwork fullscreen (the "display") while a second device (e.g. a tablet) adjusts its layer controls remotely (the "control"), paired by a shared code word, per `docs/superpowers/specs/2026-07-22-mirror-display-control-design.md`.

**Architecture:** A Vercel KV (Redis) session keyed by the code word holds the token being shown and the current layer-control overrides. A single API route (`/api/mirror/[code]`) handles joining (atomic claim-as-display-or-control via a Lua script), polling reads, patching overrides, and ending the session. Two new pages poll that route once a second: `/mirror/[code]/display` (renders the existing `ArtworkViewer` fullscreen with overrides fed in from the server) and `/mirror/[code]/control` (renders the existing layer-control UI, but pushes changes to the server instead of local state). A new "Mirror" button + code-word dialog on the existing art page is the entry point into both.

**Tech Stack:** Next.js 14 (App Router), TypeScript, `@vercel/kv`, existing `viem`/`wagmi` stack (unchanged).

---

## Prerequisite (human action — do this before Task 3)

Vercel KV must be provisioned before the API route can be tested against a real store (Tasks 1-2 don't need it; Task 3 onward does):

1. In the Vercel dashboard, open the `classic-art-editor` project → **Storage** tab → **Create Database** → choose the Upstash-backed **KV** option.
2. Connect it to the project (this auto-adds `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN` to the project's env vars for all environments).
3. Locally, run `vercel link` (if not already linked) then `vercel env pull .env.local` to pull those vars down for local dev.

If this hasn't been done yet when you reach Task 3, stop and ask the user to complete it — the KV client will throw on import without these env vars.

---

## Task 1: Shared types for the mirror session

**Files:**
- Create: `src/types/mirror.d.ts`

- [ ] **Step 1: Write the type file**

```ts
// src/types/mirror.d.ts
import { Address } from 'viem';

export type MirrorRole = 'display' | 'control';

export type MirrorSession = {
  tokenAddress: Address;
  tokenId: number;
  controlOverrides: Record<string, number>;
  displayLastSeenAt: number;
  controlLastSeenAt: number | null;
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors (there may be pre-existing unrelated errors in the project; just confirm nothing new points at `mirror.d.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/types/mirror.d.ts
git commit -m "Add MirrorSession/MirrorRole types"
```

---

## Task 2: KV-backed session store

**Files:**
- Create: `src/utils/mirror-store.ts`

This is the only module that talks to Redis. It owns the atomic claim-or-join logic, the key naming, and the TTL/staleness constants.

- [ ] **Step 1: Add the dependency**

Run: `npm install @vercel/kv`

- [ ] **Step 2: Write the store module**

```ts
// src/utils/mirror-store.ts
import { kv } from '@vercel/kv';
import { Address } from 'viem';
import { MirrorRole, MirrorSession } from '@/types/mirror';

export const MIRROR_DISPLAY_STALE_MS = 20_000; // no display heartbeat in this long => code is up for grabs again
export const MIRROR_SESSION_TTL_SECONDS = 60 * 60; // sliding 1-hour expiry, refreshed on every touch

const keyFor = (code: string) => `mirror:${code.trim().toLowerCase()}`;

// Runs as a single Redis-side script so two near-simultaneous joins for the
// same code can't both become "display" or clobber each other's write.
// NOTE: cjson.encode({}) on a genuinely empty Lua table produces JSON `[]`,
// not `{}` — the empty controlOverrides object must be tagged with
// __jsontype = 'object' or it will deserialize as an array on the client.
const CLAIM_OR_JOIN_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local staleMs = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local tokenAddress = ARGV[4]
local tokenId = tonumber(ARGV[5])

local existing = redis.call('GET', key)
local session

if existing then
  session = cjson.decode(existing)
end

if (not session) or (now - session.displayLastSeenAt > staleMs) then
  session = {
    tokenAddress = tokenAddress,
    tokenId = tokenId,
    controlOverrides = setmetatable({}, { __jsontype = 'object' }),
    displayLastSeenAt = now,
    controlLastSeenAt = cjson.null,
  }
  redis.call('SET', key, cjson.encode(session), 'EX', ttl)
  return {'display', cjson.encode(session)}
end

session.controlLastSeenAt = now
-- cjson.decode turns an empty JSON object back into an empty Lua table with
-- no way to tell it apart from an empty array, so it must be re-tagged here
-- too or a still-empty controlOverrides will flip back to `[]` on re-encode.
if next(session.controlOverrides) == nil then
  session.controlOverrides = setmetatable({}, { __jsontype = 'object' })
end
redis.call('SET', key, cjson.encode(session), 'EX', ttl)
return {'control', cjson.encode(session)}
`;

export async function claimOrJoinMirrorSession(
  code: string,
  tokenAddress: Address,
  tokenId: number,
): Promise<{ role: MirrorRole; session: MirrorSession }> {
  const [role, sessionJson] = (await kv.eval(
    CLAIM_OR_JOIN_SCRIPT,
    [keyFor(code)],
    [Date.now(), MIRROR_DISPLAY_STALE_MS, MIRROR_SESSION_TTL_SECONDS, tokenAddress, tokenId],
  )) as [MirrorRole, string];

  return { role, session: JSON.parse(sessionJson) };
}

export async function getMirrorSession(
  code: string,
  role: MirrorRole,
): Promise<MirrorSession | null> {
  const session = await kv.get<MirrorSession>(keyFor(code));
  if (!session) return null;

  const touched: MirrorSession = {
    ...session,
    ...(role === 'display'
      ? { displayLastSeenAt: Date.now() }
      : { controlLastSeenAt: Date.now() }),
  };
  await kv.set(keyFor(code), touched, { ex: MIRROR_SESSION_TTL_SECONDS });
  return touched;
}

export async function patchMirrorControlOverrides(
  code: string,
  overrides: Record<string, number>,
): Promise<MirrorSession | null> {
  const session = await kv.get<MirrorSession>(keyFor(code));
  if (!session) return null;

  const updated: MirrorSession = {
    ...session,
    controlOverrides: { ...session.controlOverrides, ...overrides },
    controlLastSeenAt: Date.now(),
  };
  await kv.set(keyFor(code), updated, { ex: MIRROR_SESSION_TTL_SECONDS });
  return updated;
}

export async function deleteMirrorSession(code: string): Promise<boolean> {
  const deletedCount = await kv.del(keyFor(code));
  return deletedCount > 0;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/utils/mirror-store.ts
git commit -m "Add Vercel KV-backed mirror session store"
```

---

## Task 3: Mirror API route

**Files:**
- Create: `src/app/api/mirror/[code]/route.ts`

Requires the Prerequisite above to be done (real `KV_REST_API_URL`/`KV_REST_API_TOKEN` in `.env.local`) to test end-to-end.

- [ ] **Step 1: Write the route**

```ts
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
```

- [ ] **Step 2: Manually verify against a real KV store**

Run: `npm run dev`, then in another terminal:

```bash
# First call for a code claims display
curl -s -X POST localhost:3000/api/mirror/testword \
  -H 'Content-Type: application/json' \
  -d '{"tokenAddress":"0xbb4ec6f77f8ab3232abb22893def072c9a848bed","tokenId":1}'
# Expected: {"role":"display"}

# Second call for the same code joins as control
curl -s -X POST localhost:3000/api/mirror/testword \
  -H 'Content-Type: application/json' \
  -d '{"tokenAddress":"0xbb4ec6f77f8ab3232abb22893def072c9a848bed","tokenId":1}'
# Expected: {"role":"control","tokenAddress":"0xbb4ec...","tokenId":1}

curl -s 'localhost:3000/api/mirror/testword?role=display'
# Expected: session JSON with controlOverrides: {} (an object, not an array — this is the cjson gotcha check)

curl -s -X PATCH localhost:3000/api/mirror/testword \
  -H 'Content-Type: application/json' \
  -d '{"516-0": 3}'
# Expected: session JSON with controlOverrides: {"516-0":3}

curl -s -X DELETE localhost:3000/api/mirror/testword
# Expected: {"ok":true}

curl -s 'localhost:3000/api/mirror/testword?role=display'
# Expected: 404 {"error":"Session not found"}
```

If `controlOverrides` comes back as `[]` instead of `{}`, the `__jsontype = 'object'` tag in the Lua script didn't take — double check it's applied to the table before `cjson.encode`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mirror/
git commit -m "Add mirror session API route"
```

---

## Task 4: Extract `useTokenMetadata` from `useArtwork`

**Files:**
- Create: `src/hooks/useTokenMetadata.ts`
- Modify: `src/hooks/useArtwork.tsx`

`useArtwork` currently does two things in two effects: (1) fetch token metadata/tokenURI/owner and (2) composite the layer images. The mirror control page needs (1) only — it must not trigger the expensive per-layer image fetch/composite on a tablet. Pull effect 1 out into its own hook; `useArtwork` keeps its public return shape unchanged by calling the new hook internally.

- [ ] **Step 1: Write `useTokenMetadata`**

```ts
// src/hooks/useTokenMetadata.ts
import { useState, useEffect, useRef } from 'react';
import { Address, getContract } from 'viem';
import v1Abi from '@/abis/v1Abi';
import v2Abi from '@/abis/v2Abi';
import { V1_CONTRACT_ADDRESS } from '@/config';
import { MasterArtNFTMetadata } from '@/types/shared';
import { fetchIpfs } from '@/utils/ipfs';
import { getMasterArtSize } from '@/components/master-art-viewer/utils';

export const useTokenMetadata = (tokenAddress: Address, tokenId: number) => {
  const isComponentMountedRef = useRef(true);
  const [statusMessage, setStatusMessage] = useState<string>(
    'Loading NFT metadata...',
  );
  const [metadata, setMetadata] = useState<MasterArtNFTMetadata>();
  const [collector, setCollector] = useState<Address>();
  const [error, setError] = useState<string>();
  const [isLandscape, setIsLandscape] = useState(false);
  const [fetchedTokenURI, setFetchedTokenURI] = useState<string>();
  const [masterArtSize, setMasterArtSize] = useState<{
    width: number;
    height: number;
    resizeToFitScreenRatio: number;
  }>();
  const [artists, setArtists] = useState<string[]>([]);

  useEffect(() => {
    isComponentMountedRef.current = true;
    const fetchMetadata = async () => {
      setStatusMessage('Loading NFT metadata...');
      setError(undefined);
      try {
        const { publicClient } = await import('@/utils/rpcClient');

        const contract = getContract({
          address: tokenAddress,
          abi: tokenAddress === V1_CONTRACT_ADDRESS ? v1Abi : v2Abi,
          client: publicClient,
        });

        let tokenURI;
        try {
          tokenURI = await contract.read.tokenURI([BigInt(tokenId)]);
          if (!isComponentMountedRef.current) return;
          setFetchedTokenURI(tokenURI);
          if (!tokenURI) throw new Error('URI query for nonexistent token');

          const owner = await contract.read.ownerOf([BigInt(tokenId)]);
          if (!isComponentMountedRef.current) return;
          setCollector(owner);
        } catch (e: any) {
          console.error('Contract read error:', e);
          const errorMessage = e?.message?.toLowerCase() || '';

          if (
            errorMessage.includes('query for nonexistent token') ||
            errorMessage.includes('execution reverted') ||
            errorMessage.includes('invalid token id')
          ) {
            throw new Error('Token not found. Please check the version and ID.');
          } else {
             throw new Error(`Failed to load token data: ${e.message || 'Unknown error'}`);
          }
        }

        const response = await fetchIpfs(tokenURI);
        const metadata = (await response.json()) as MasterArtNFTMetadata;
        if (!isComponentMountedRef.current) return;
        setMetadata(metadata);

        if (metadata.attributes) {
          const extractedArtists = metadata.attributes
            .filter(
              (attr: any) =>
                attr.trait_type === 'Artist' || attr.trait_type === 'Creator',
            )
            .map((attr: any) => attr.value);
          setArtists(extractedArtists);
        }

        const size = await getMasterArtSize(metadata.image);
        if (!isComponentMountedRef.current) return;
        setMasterArtSize(size);
        setIsLandscape(size.width > size.height);
      } catch (e: any) {
        console.error(e);
        if (isComponentMountedRef.current) {
          setError(e.message);
          setStatusMessage('');
        }
      }
    };

    if (tokenAddress && !isNaN(tokenId)) {
      fetchMetadata();
    }

    return () => {
      isComponentMountedRef.current = false;
    };
  }, [tokenAddress, tokenId]);

  return {
    statusMessage,
    metadata,
    collector,
    error,
    isLandscape,
    tokenURI: fetchedTokenURI,
    masterArtSize,
    artists,
  };
};
```

- [ ] **Step 2: Update `useArtwork` to use it**

Replace the first effect (metadata fetch, currently lines 17-120 of `src/hooks/useArtwork.tsx`) and its associated state with a call to `useTokenMetadata`. The file should look like this afterward:

```ts
// src/hooks/useArtwork.tsx
import { useState, useEffect, useRef } from 'react';
import { Address } from 'viem';
import { useTokenMetadata } from '@/hooks/useTokenMetadata';
import {
  createGetLayerControlTokenValueFn,
  getLayersFromMetadata,
} from '@/components/master-art-viewer/utils';
import LayerImageBuilder, {
  LayerImageElement,
} from '@/components/master-art-viewer/layer-image-builder';

export const useArtwork = (
  tokenAddress: Address,
  tokenId: number,
  controlOverrides: Record<string, number> = {},
) => {
  const isComponentMountedRef = useRef(true);
  const artElementRef = useRef<HTMLDivElement>(null);
  const [layerStatusMessage, setLayerStatusMessage] = useState<
    string | React.JSX.Element
  >('');
  const [layerHashes, setLayerHashes] = useState<Record<string, string>>({});

  const layerBlobUrlsRef = useRef<Record<string, string>>({});

  const {
    statusMessage: metadataStatusMessage,
    metadata,
    collector,
    error,
    isLandscape,
    tokenURI,
    masterArtSize,
    artists,
  } = useTokenMetadata(tokenAddress, tokenId);

  useEffect(() => {
    isComponentMountedRef.current = true;
    return () => {
      isComponentMountedRef.current = false;
    };
  }, []);

  // Render Layers (re-runs if metadata or overrides change)
  useEffect(() => {
    const renderLayers = async () => {
      if (!metadata || !masterArtSize || !artElementRef.current) return;
      if (error) return;

      try {
        const getLayerControlTokenValue = createGetLayerControlTokenValueFn(
          tokenId,
          metadata['async-attributes']?.['unminted-token-values'],
          controlOverrides,
        );

        if (!isComponentMountedRef.current) return;

        const layers = await getLayersFromMetadata(
          metadata.layout.layers,
          getLayerControlTokenValue,
        );

        const artElement = artElementRef.current;
        const { width, height, resizeToFitScreenRatio } = masterArtSize;
        const marginTop =
          (window.innerHeight - height * resizeToFitScreenRatio) / 2;

        artElement.style.marginTop = marginTop > 0 ? `${marginTop}px` : `0px`;
        artElement.style.width = `${width * resizeToFitScreenRatio}px`;
        artElement.style.height = `${height * resizeToFitScreenRatio}px`;

        artElement.innerHTML = '';

        const newLayerHashes: Record<string, string> = {};

        const layerBuilders = layers.map((layer) => {
          const builder = new LayerImageBuilder(
            layer.id,
            layer.transformationProperties,
            getLayerControlTokenValue,
          );
          builder.setLayoutVersion(metadata.layout.version || 1);

          const loadTask = async () => {
            const cachedUrl = layerBlobUrlsRef.current[layer.activeStateURI];

            const blobUrl = await builder.loadImage(
              layer.activeStateURI,
              (domain) =>
                setLayerStatusMessage(
                  <>
                    Loading layers...
                    <br />
                    Loading {layer.activeStateURI} from{' '}
                    <a target="_blank" href={`https://${domain}`}>
                      {domain}
                    </a>
                  </>,
                ),
              cachedUrl,
            );

            if (blobUrl) {
                layerBlobUrlsRef.current[layer.activeStateURI] = blobUrl;
            }
          };

          return {
            layer,
            builder,
            loadPromise: loadTask(),
          };
        });

        for (const { layer, builder, loadPromise } of layerBuilders) {
          try {
            if (!isComponentMountedRef.current) return;

            await loadPromise;

            if (layer.anchor) {
              const anchorImageEl = Array.from(artElement.children).find(
                (el) => el.id === layer.anchor,
              ) as LayerImageElement;
              builder.setAnchorLayer(anchorImageEl);
            }

            const layerImageElement = await builder.build();
            layerImageElement.resize(resizeToFitScreenRatio);
            artElement.appendChild(layerImageElement);
            newLayerHashes[layer.id] = layer.activeStateURI;
          } catch (e: any) {
            console.error(`Failed to load layer ${layer.id}:`, e);
          }
        }

        if (!isComponentMountedRef.current) return;
        setLayerHashes(newLayerHashes);

        artElement.classList.remove('-z-20');
        setLayerStatusMessage('');
      } catch (e: any) {
        console.error(e);
        if (isComponentMountedRef.current) {
          setLayerStatusMessage('');
        }
      }
    };

    renderLayers();
  }, [metadata, masterArtSize, controlOverrides, tokenId, error]);

  return {
    artElementRef,
    statusMessage: metadataStatusMessage || layerStatusMessage,
    metadata,
    collector,
    error,
    layerHashes,
    isLandscape,
    tokenURI,
    artists,
    masterArtSize,
  };
};
```

Note the returned `statusMessage` is `metadataStatusMessage || layerStatusMessage` — while metadata is still loading, that message wins; once it clears, the layer-loading message (if any) shows. This reproduces the original single-state-var behavior since the two phases never overlap.

- [ ] **Step 3: Manually verify nothing broke**

Run: `npm run dev`, open an existing artwork at `/v2/<some-token-id>` (pick one you know renders, e.g. from `/gallery/masters`).
Expected: artwork loads and renders identically to before this change — image composites, layer modal still lists layers, no new console errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTokenMetadata.ts src/hooks/useArtwork.tsx
git commit -m "Extract useTokenMetadata from useArtwork"
```

---

## Task 5: Extract `useLayersWithArtists` from `ArtworkViewer`

**Files:**
- Create: `src/hooks/useLayersWithArtists.ts`
- Modify: `src/components/artwork/artwork-viewer.tsx`

`ArtworkViewer` currently derives its layer list (filtering `layers.json` by `tokenURI`, then fetching artist names + contract addresses) inline. The mirror control page needs the same derivation without rendering any artwork. Extract it; fold `contractAddress` onto each returned layer object so callers don't need a separate `layerContracts` map.

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/useLayersWithArtists.ts
import { useEffect, useState } from 'react';
import { Address } from 'viem';
import layersData from '@/layers.json';
import { fetchIpfs } from '@/utils/ipfs';
import { resolveLayerContract } from '@/utils/contract-helpers';

export const useLayersWithArtists = (
  tokenAddress?: Address,
  tokenURI?: string,
) => {
  const [layerArtists, setLayerArtists] = useState<Record<string, string>>({});
  const [layerContracts, setLayerContracts] = useState<Record<string, Address>>({});

  const layers = (
    (tokenAddress && layersData[tokenAddress as keyof typeof layersData]) || []
  )
    .filter((l: any) => {
      if (!tokenURI) return false;
      return tokenURI.includes(l.masterTokenId);
    })
    .map((l: any) => ({
      ...l,
      tokenId: parseInt(l.tokenId, 10),
    }));

  useEffect(() => {
    const fetchLayerArtists = async () => {
      const { publicClient } = await import('@/utils/rpcClient');

      const newLayerArtists: Record<string, string> = {};
      const newLayerContracts: Record<string, Address> = {};

      const promises = layers.map(async (layer) => {
        if (layerArtists[layer.tokenId]) return;

        try {
          let metadataUri = (layer as any).metadataUri;
          let contractAddress: Address | undefined;

          if (!metadataUri) {
            try {
              const result = await resolveLayerContract(layer.tokenId, publicClient);
              if (result) {
                metadataUri = result.tokenURI;
                contractAddress = result.contractAddress;
              }
            } catch (e) {
              console.error(
                `Failed to fetch tokenURI from contract for layer ${layer.tokenId}`,
                e,
              );
              return;
            }
          }

          if (!metadataUri) return;

          if (contractAddress) {
            newLayerContracts[layer.tokenId] = contractAddress;
          }

          const res = await fetchIpfs(metadataUri);
          const data = await res.json();
          const artistAttr = data.attributes?.find(
            (attr: any) =>
              attr.trait_type === 'Artist' || attr.trait_type === 'Creator',
          );
          if (artistAttr) {
            newLayerArtists[layer.tokenId] = artistAttr.value;
          }
        } catch (err) {
          console.error(
            `Failed to fetch metadata for layer ${layer.tokenId}`,
            err,
          );
        }
      });

      await Promise.all(promises);
      if (Object.keys(newLayerArtists).length > 0) {
        setLayerArtists((prev) => ({ ...prev, ...newLayerArtists }));
      }
      if (Object.keys(newLayerContracts).length > 0) {
        setLayerContracts((prev) => ({ ...prev, ...newLayerContracts }));
      }
    };

    if (layers.length > 0) {
      fetchLayerArtists();
    }
    // Deps are the actual identifying inputs (not the derived `layers` array,
    // which is a new reference every render) so this doesn't re-run on every
    // unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenAddress, tokenURI]);

  return layers.map((layer) => ({
    ...layer,
    artistName: layerArtists[layer.tokenId] || layer.artistName,
    contractAddress: layerContracts[layer.tokenId],
  }));
};
```

- [ ] **Step 2: Update `ArtworkViewer` to use it**

In `src/components/artwork/artwork-viewer.tsx`:
- Remove the `layerArtists`/`layerContracts` `useState` declarations and the inline `layers`/`useEffect`/`layersWithArtists` block (current lines ~53, 69-158).
- Add `import { useLayersWithArtists } from '@/hooks/useLayersWithArtists';`
- Replace with:

```ts
const layersWithArtists = useLayersWithArtists(tokenAddress, tokenURI);
```

- Update the `LayerControlDialog` usage:

```tsx
<LayerControlDialog
  layer={selectedLayer}
  isOpen={!!selectedLayer}
  onClose={() => setSelectedLayer(null)}
  onPreview={(controlTokenId, values) =>
    setControlOverrides((prev) => ({ ...prev, ...values }))
  }
  currentValues={controlOverrides}
  contractAddress={selectedLayer?.contractAddress}
/>
```

(dropping the old `layerContracts[selectedLayer.tokenId]` lookup, since `contractAddress` is now merged onto `selectedLayer` directly by the hook).

- [ ] **Step 3: Manually verify**

Run: `npm run dev`, open an artwork with layers (check `/gallery/layers` for one with entries), confirm the layer list still shows, clicking a layer still opens `LayerControlDialog` with controls and (if you own it) the on-chain update button still works the same as before.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useLayersWithArtists.ts src/components/artwork/artwork-viewer.tsx
git commit -m "Extract useLayersWithArtists from ArtworkViewer"
```

---

## Task 6: Controlled `externalControlOverrides` prop on `ArtworkViewer`

**Files:**
- Modify: `src/components/artwork/artwork-viewer.tsx`

The display page needs to feed server-polled overrides into `ArtworkViewer` without disturbing its existing local-preview behavior (used when someone views an artwork normally and previews changes themselves).

- [ ] **Step 1: Add the prop**

Add to `ArtworkViewerProps`:

```ts
externalControlOverrides?: Record<string, number>;
```

Add to the function signature's destructured props: `externalControlOverrides,`.

Add an effect right after the existing `controlOverrides` state declaration:

```ts
useEffect(() => {
  if (externalControlOverrides) {
    setControlOverrides((prev) => ({ ...prev, ...externalControlOverrides }));
  }
}, [externalControlOverrides]);
```

- [ ] **Step 2: Manually verify existing behavior is unchanged**

Run: `npm run dev`, open an artwork, open a layer's controls, hit Preview — confirm the artwork still updates locally as before (this prop is `undefined` in this flow, so the new effect is a no-op).

- [ ] **Step 3: Commit**

```bash
git add src/components/artwork/artwork-viewer.tsx
git commit -m "Add externalControlOverrides prop to ArtworkViewer"
```

---

## Task 7: Mirror entry dialog + button on `ArtworkViewer`

**Files:**
- Create: `src/components/artwork/mirror-dialog.tsx`
- Modify: `src/components/artwork/artwork-viewer.tsx`

- [ ] **Step 1: Write the dialog**

```tsx
// src/components/artwork/mirror-dialog.tsx
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Address } from 'viem';
import { Modal } from '@/components/common/modal';

type MirrorDialogProps = {
  tokenAddress: Address;
  tokenId: number;
  onClose: () => void;
};

export default function MirrorDialog({
  tokenAddress,
  tokenId,
  onClose,
}: MirrorDialogProps) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [state, setState] = useState<'default' | 'loading' | 'error'>('default');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) return;

    setState('loading');
    try {
      const res = await fetch(`/api/mirror/${encodeURIComponent(trimmed)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress, tokenId }),
      });

      if (!res.ok) throw new Error('Failed to join mirror session');
      const { role } = await res.json();

      router.push(`/mirror/${encodeURIComponent(trimmed)}/${role}`);
    } catch (err) {
      console.error(err);
      setState('error');
    }
  };

  return (
    <Modal title="Mirror This Artwork" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label htmlFor="mirror-code" className="text-sm font-bold">
          Code Word
        </label>
        <input
          id="mirror-code"
          name="mirror-code"
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-1 w-full"
          placeholder="e.g. sunset"
        />
        <p className="text-xs text-gray-500 mt-2">
          Enter this same word on a second device to control this artwork's
          layers remotely. Whichever device submits first becomes the
          fullscreen display; the second becomes the controller.
        </p>
        <button
          disabled={state === 'loading'}
          className="btn btn-black w-full mt-4"
        >
          {state === 'loading' ? 'Connecting...' : 'Go'}
        </button>
        {state === 'error' && (
          <p className="text-red text-sm text-center mt-3">
            Unexpected error occured. Please try again.
          </p>
        )}
      </form>
    </Modal>
  );
}
```

- [ ] **Step 2: Wire the button into `ArtworkViewer`**

Add `isMirrorDialogOpen` state, an import for `MirrorDialog`, and an import for a cast-like icon from `react-feather` (try `Cast`; if it doesn't exist in this version, fall back to `Tv`). Add the button next to the existing Layers/Fullscreen buttons:

```tsx
<button
  onClick={() => setIsMirrorDialogOpen(true)}
  className="bg-gray-800 text-white p-2 rounded-full"
  aria-label="Mirror to another device"
>
  <Cast />
</button>
```

Render the dialog near the other modals:

```tsx
{isMirrorDialogOpen && (
  <MirrorDialog
    tokenAddress={tokenAddress}
    tokenId={tokenId}
    onClose={() => setIsMirrorDialogOpen(false)}
  />
)}
```

- [ ] **Step 3: Manually verify**

Run: `npm run dev`, open an artwork, click the new Mirror button, type a code word, submit. Confirm it navigates to `/mirror/<code>/display` (Task 8 hasn't built that page yet, so a 404 here is expected and fine — you're only confirming the dialog, the POST, and the redirect happen). Check the Network tab: the POST should return `{"role":"display"}`.

- [ ] **Step 4: Commit**

```bash
git add src/components/artwork/mirror-dialog.tsx src/components/artwork/artwork-viewer.tsx
git commit -m "Add Mirror button and code-word dialog to ArtworkViewer"
```

---

## Task 8: Display page

**Files:**
- Create: `src/app/mirror/[code]/display/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// src/app/mirror/[code]/display/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Address } from 'viem';
import ArtworkViewer from '@/components/artwork/artwork-viewer';
import { MirrorSession } from '@/types/mirror';

const POLL_INTERVAL_MS = 1000;

export default function MirrorDisplayPage({
  params,
}: {
  params: { code: string };
}) {
  // tokenAddress/tokenId are set once and never change for the life of a
  // session, so they're kept separate from `overrides`. Only `overrides`
  // needs to become a new object reference on every poll tick that actually
  // changes something — otherwise ArtworkViewer's externalControlOverrides
  // effect (Task 6) would feed useArtwork a "new" object every ~1s even when
  // nothing changed, re-triggering the full layer recomposite on every poll.
  const [token, setToken] = useState<{ tokenAddress: Address; tokenId: number } | null>();
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [ended, setEnded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const lastOverridesJsonRef = useRef<string>('{}');

  useEffect(() => {
    const poll = async () => {
      const res = await fetch(
        `/api/mirror/${encodeURIComponent(params.code)}?role=display`,
      );

      if (res.status === 404) {
        setEnded(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }

      const data = (await res.json()) as MirrorSession;
      setToken((prev) =>
        prev ?? { tokenAddress: data.tokenAddress, tokenId: data.tokenId },
      );

      const overridesJson = JSON.stringify(data.controlOverrides);
      if (overridesJson !== lastOverridesJsonRef.current) {
        lastOverridesJsonRef.current = overridesJson;
        setOverrides(data.controlOverrides);
      }
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [params.code]);

  if (ended) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center px-4">
        <p className="text-xl mb-4">This mirror session has ended.</p>
        <Link href="/gallery/masters" className="underline">
          Back to Gallery
        </Link>
      </div>
    );
  }

  if (!token) {
    return <div className="flex items-center justify-center h-screen" />;
  }

  return (
    <ArtworkViewer
      tokenAddress={token.tokenAddress}
      tokenId={token.tokenId}
      artContainerClassName="w-full"
      initialFullscreen
      externalControlOverrides={overrides}
    />
  );
}
```

- [ ] **Step 2: Manually verify**

With the Prerequisite KV store in place: open the art page for a known token, click Mirror, submit a code word (say `sunset`). Confirm you land on `/mirror/sunset/display` showing the artwork fullscreen.

- [ ] **Step 3: Commit**

```bash
git add src/app/mirror/
git commit -m "Add mirror display page"
```

---

## Task 9: Control page

**Files:**
- Create: `src/components/mirror/mirror-control-panel.tsx`
- Create: `src/app/mirror/[code]/control/page.tsx`

- [ ] **Step 1: Write the control panel component**

```tsx
// src/components/mirror/mirror-control-panel.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Address } from 'viem';
import { useTokenMetadata } from '@/hooks/useTokenMetadata';
import { useLayersWithArtists } from '@/hooks/useLayersWithArtists';
import LayerControlList from '@/components/artwork/layer-control-list';
import LayerControlDialog from '@/components/artwork/layer-control-dialog';
import { MirrorSession } from '@/types/mirror';

const POLL_INTERVAL_MS = 1000;

export default function MirrorControlPanel({ code }: { code: string }) {
  const [session, setSession] = useState<MirrorSession | null>();
  const [ended, setEnded] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const poll = async () => {
      const res = await fetch(
        `/api/mirror/${encodeURIComponent(code)}?role=control`,
      );

      if (res.status === 404) {
        setEnded(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }

      const data = (await res.json()) as MirrorSession;
      setSession(data);
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [code]);

  const { metadata, tokenURI } = useTokenMetadata(
    session?.tokenAddress as Address,
    session?.tokenId as number,
  );
  const layers = useLayersWithArtists(session?.tokenAddress, tokenURI);

  const handleStopMirroring = async () => {
    await fetch(`/api/mirror/${encodeURIComponent(code)}`, { method: 'DELETE' });
    setEnded(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  if (ended) {
    return <p className="text-center mt-12">Mirror session ended.</p>;
  }

  if (!session) {
    return <p className="text-center mt-12">Connecting...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">
          {metadata?.name || 'Mirror Controls'}
        </h1>
        <button
          onClick={handleStopMirroring}
          className="text-sm text-red border border-red rounded px-3 py-1"
        >
          Stop Mirroring
        </button>
      </div>
      <LayerControlList layers={layers} onLayerClick={setSelectedLayer} />
      <LayerControlDialog
        layer={selectedLayer}
        isOpen={!!selectedLayer}
        onClose={() => setSelectedLayer(null)}
        onPreview={(_controlTokenId, values) => {
          fetch(`/api/mirror/${encodeURIComponent(code)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
          });
        }}
        currentValues={session.controlOverrides}
        contractAddress={selectedLayer?.contractAddress}
      />
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
// src/app/mirror/[code]/control/page.tsx
import MirrorControlPanel from '@/components/mirror/mirror-control-panel';

export default function MirrorControlPage({
  params,
}: {
  params: { code: string };
}) {
  return <MirrorControlPanel code={params.code} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/mirror/ src/app/mirror/
git commit -m "Add mirror control page"
```

---

## Task 10: End-to-end manual verification

No automated test runner exists in this project (manual QA is the existing convention). Verify the whole feature together:

- [ ] **Step 1: Two-tab local test**

1. `npm run dev`.
2. Open an artwork with layers (check `/gallery/layers` for a token that has at least one control), click Mirror, submit code word `demo`. Confirm this tab now shows `/mirror/demo/display` fullscreen.
3. In a second tab (or second device on the same LAN, using your machine's local IP instead of `localhost`), open the same artwork's art page, click Mirror, submit `demo` again. Confirm this tab now shows `/mirror/demo/control` with the layer list.
4. Open a layer's controls on the control tab, adjust a slider, hit Preview.
5. Within ~1s, confirm the display tab's artwork visibly updates to match.

- [ ] **Step 2: Stop Mirroring**

Click "Stop Mirroring" on the control tab. Confirm the control tab shows "Mirror session ended." and, within ~1s, the display tab also shows "This mirror session has ended." with a link back to the gallery.

- [ ] **Step 3: Stale/expiry re-claim**

Temporarily lower `MIRROR_DISPLAY_STALE_MS` in `src/utils/mirror-store.ts` to something like `3000` for this test only. Open a display tab for a code word, then close it (don't click Stop Mirroring — just close the tab so its heartbeat stops). Wait ~5s, then open the *same* artwork+code combination from a fresh tab and click Mirror. Confirm this fresh tab becomes the new `display` (not `control`) since the old one went stale. Revert the constant back to `20_000` afterward.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "Mirror display/control feature complete" --allow-empty
```

(Use `--allow-empty` only if Step 3's revert is the only uncommitted change and it nets out to no diff versus Task 2's commit; otherwise commit the revert normally without `--allow-empty`.)
