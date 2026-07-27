# Architecture & Feature Notes

This documents the redesign and feature work done on the `redesign/gallery-grade-ui` branch, so future work has a map instead of needing to re-derive it. Written after the fact from the actual code and commit history — if something here disagrees with the code, trust the code and update this doc.

## Design system

Tokens live as CSS custom properties in `src/styles/globals.css` (`:root` for light, `.dark` for dark), wired into Tailwind via `tailwind.config.ts` as `rgb(var(--x) / <alpha-value>)` so opacity modifiers (`bg-surface-raised/75` etc.) keep working. Semantic classes to use in new UI: `bg-surface`, `bg-surface-raised`, `bg-surface-sunken`, `border-border`, `border-border-strong`, `text-text`, `text-text-muted`, `text-text-inverse`, `bg-accent`/`text-accent`/`border-accent` (+`hover:bg-accent-hover`), `bg-danger`, `bg-success`. Plus a theme-invariant `bg-art-bed` (`#000000`) for the artwork canvas specifically — always black regardless of theme (gallery convention).

Dark mode toggles the `dark` class on `<html>`, set pre-hydration by an inline script in `src/app/layout.tsx` (avoids flash-of-wrong-theme), persisted to `localStorage`. Toggle button lives in `src/components/site-header.tsx`.

Two border radii only: `rounded-lg` (cards/inputs/buttons), `rounded-2xl` (modals). Buttons: `.btn-primary`/`.btn-secondary`/`.btn-ghost` (defined in `globals.css`).

`SiteHeader` (`src/components/site-header.tsx`) is mounted once in `src/app/layout.tsx` and appears on every route except `/mirror/[code]/display` (must stay chrome-free for the mirror-display use case — see the pathname regex at the top of that file if you need to add another exclusion). Nav links live in that file's `NAV_LINKS` array; external links need `external: true` to get `target="_blank" rel="noopener noreferrer"`.

## Data flow

- `src/masters.json` / `src/layers.json` — static snapshots of on-chain master/layer token data, keyed by contract address. `src/utils/masters.ts` / `src/utils/layers.ts` turn these into `GalleryItem[]` for the `Gallery` component (`src/components/gallery/Gallery.tsx`, shared by the homepage, `/gallery/masters`, `/gallery/layers`, and the Async Wallet's owned-items lists).
- `src/hooks/useTokenMetadata.ts` fetches a master's IPFS metadata + on-chain `ownerOf`/`tokenURI`. `src/hooks/useArtwork.tsx` builds on top of it to actually composite the layers into DOM `<img>` elements (via `src/components/master-art-viewer/layer-image-builder.ts`) inside `#master-art`, rendered by `src/components/artwork/artwork-viewer.tsx` (the full-bleed art page at `src/app/[version]/[id]/page.tsx`).
- Layer compositing (`LayerImageBuilder`) applies each control (opacity, blend mode, hue/brightness/saturation/RGB via an SVG `feColorMatrix`, scale, rotation, position) as CSS on each layer `<img>`, resolving on-chain lever values through `createGetLayerControlTokenValueFn` (`src/components/master-art-viewer/utils.ts`), which checks local preview overrides first, then falls back to the real contract read.
- `src/hooks/useLayersWithArtists.ts` resolves each layer's artist name (fetches IPFS metadata per layer) and `contractAddress` for the artwork page's layer list/dialog.

## Contract interaction conventions

- `src/utils/rpcClient.ts` exports a single viem `publicClient`, network-selected by `__PROD__` (`src/config.ts`) — mainnet in prod, Goerli otherwise. **`npm run dev` sets `NEXT_PUBLIC_ACTIVE_NETWORK=1`, so `__PROD__` is true even in local dev** — the real mainnet V1/V2 contract addresses are in effect locally, not testnet. Don't assume dev == testnet without checking this.
- `src/utils/contract-helpers.ts`: `getAbiForAddress(address)` (picks v1/v2 ABI), `resolveLayerContract(tokenId, publicClient)` (brute-force V2-then-V1 `tokenURI()` probe, used when a layer's contract isn't already known), `getTokenOwner(contractAddress, tokenId, publicClient)` (the `ownerOf` read, added during the Layer Detail feature — reuse this rather than re-inlining `getContract(...).read.ownerOf(...)`, which is still duplicated 3x elsewhere: `useTokenMetadata.ts`, `useArtwork.tsx`, `layer-control-dialog.tsx` — a good small refactor if touching any of those again).
- On-chain writes (`layer-control-dialog.tsx`'s "Update on Chain") use wagmi's `useWriteContract` + `useWaitForTransactionReceipt` to track real confirmation (not just mempool submission), then apply the same values to `controlOverrides` so the art updates immediately without a reload.
- Server-side Alchemy-backed proxy routes (`src/app/api/rpc/route.ts`, `src/app/api/owned-nfts/route.ts`, `src/app/api/ens/route.ts`) all follow the same pattern: validate input, guard on `ALCHEMY_KEY` presence, log upstream errors server-side only (never forward error bodies to the client — Alchemy embeds the key in the request URL, and some upstream error pages echo the requested URI). `/api/ens` always resolves against mainnet regardless of `ACTIVE_NETWORK`, since ENS doesn't exist on Goerli.

## Feature inventory (this branch, chronological)

1. **Token system + dark mode** (`439fec3`) — described above.
2. **Persistent header + theme toggle** (`2f1dfeb`).
3. **Full-bleed artwork page rebuild** (`d057428`, fixes in `fee642c`) — `artwork-viewer.tsx`: `fixed inset-0 bg-art-bed` art viewport, slide-in description overlay (`z-30`, right-anchored, `bg-surface-raised/75`), floating control pill (Layers/Fullscreen/Mirror/Download, bottom-left, `z-40` so it's never hidden behind the panel).
4. **Branded loading state** (`3b4d09d`) — `src/components/artwork/artwork-loader.tsx`.
5. **Buttons/inputs/modals on tokens** (`f199de7`).
6. **Gallery card restyle + pagination** (`703caa6`) — `Gallery.tsx`, 24/page, `limit` prop for teaser embeds (homepage), `defaultSortOption`/`defaultSortDirection` props (homepage defaults to oldest-tokenId-first).
7. **Typography** (`077ce44`) — full Chivo weight range.
8. **Async Wallet page** (`fc3a4e0`, fixes in `14713ad`/`51b6768`) — `/wallet`, `src/app/api/owned-nfts/route.ts` (Alchemy `getNFTsForOwner`), `src/hooks/useOwnedAsyncNfts.ts`. Known gotcha already hit twice: Alchemy's response shape varies (`contractAddress` flat vs nested `contract.address`) — the route handles both defensively now.
9. **Layer Detail popup + shareable page** (`3e89cb5`) — click an info icon (Layers Gallery card, master artwork's layer list, layer control dialog, Async Wallet's owned-layers section — all four share one code path via `Gallery.tsx`'s `isLayer` flag) to open a modal with the layer's full metadata + current owner. Backed by `src/hooks/useLayerDetail.ts` (react-query, 60s staleTime) and a global `LayerDetailModalProvider` (`src/components/layer/layer-detail-provider.tsx`) mounted in `src/app/providers.tsx`. Has a real shareable URL (`/layer/[contract]/[tokenId]`) synced via `history.pushState`/`popstate` rather than a real Next.js route transition, specifically so opening/closing never re-fetches from IPFS.
10. **RGB/RED/GREEN/BLUE/GREYSCALE layer color controls** (`846bc61`) — these on-chain control types existed in the data but were never applied by the renderer; fixed via a new SVG `feColorMatrix` filter in `layer-image-builder.ts` (CSS `filter` alone can't do independent per-channel RGB). GREYSCALE's mapping (to a `brightness()` term) is flagged in the code as best-effort/lower-confidence — the on-chain schema doesn't fully specify its intended semantics.
11. **Download-artwork blank-half bug** (`719f418`) — `html-to-image`'s SVG capture is sensitive to the captured node's own page-relative (viewport) offset, not just its local coordinate space; fixed by capturing a detached, off-screen-but-behind-real-content clone pinned to page (0,0) instead of the live node. See the long comment in `src/utils/download-artwork.ts` if this area needs touching again — it's non-obvious.
12. **Homepage gallery: full grid, oldest-first** (`2519d64`).
13. **Donate link** (`d129f97`) — plain external link to Juicebox (`juicebox.money/v5/eth:70`); embedding it via iframe was tried and ruled out — Juicebox sends `X-Frame-Options: DENY` + a CSP `frame-ancestors` allowlist that excludes this domain.
14. **Iframe override for 3 broken-composite masters** (`4817771`) — `src/artwork-overrides.json` (flat `tokenId -> slug` map), checked in `src/app/[version]/[id]/page.tsx` before rendering the normal `ArtworkViewer`. Currently: The Gate (805), The Android of Dorian Grey VI (616), The Arcana Crypto Tarot (1524) → iframed from `asyncart-revival.bardionson.com` (a separate project, same owner, which renders these correctly). **If more masters turn out to have unfixable client-side compositing bugs, add them here rather than special-casing further** — this is the intended extension point.
15. **ENS names on wallet addresses** (`10e0ae1`, restyled `a2f2ed2`) — `src/components/common/address-with-ens.tsx`, used by `artwork-viewer.tsx`'s Collector field and `layer-detail-content.tsx`'s Owner field. When an ENS name resolves it becomes the primary (bold) line with the address shown smaller underneath; otherwise just the address. Backed by `src/hooks/useEnsNameLookup.ts` + `src/app/api/ens/route.ts` (always mainnet).

## Testing

`vitest` (added this branch — there was no test runner before). `npm test` runs `NEXT_PUBLIC_ACTIVE_NETWORK=1 vitest run`. Config: `vitest.config.ts` (path alias `@/` → `src/`), `vitest.setup.ts` (loads `.env.local`/`.env` via `@next/env`, same loader Next itself uses, so a real `ALCHEMY_KEY` in `.env.local` is picked up automatically).

Existing tests, several of which hit _real_ external services (Alchemy, mainnet RPC) rather than mocking — skip gracefully (`describe.skipIf`) when `ALCHEMY_KEY` isn't set, don't fail:

- `src/app/api/owned-nfts/route.test.ts` — real wallet, asserts the exact known-owned token set (regression test for a real field-mapping bug).
- `src/app/api/ens/route.test.ts` — resolves `vitalik.eth`'s real address, plus a known-no-ENS address and input validation.
- `src/components/master-art-viewer/layer-image-builder.test.ts` — pure matrix-math unit tests for the RGB color-channel fix.
- `src/utils/layers.test.ts` — pure-function tests for the Layer Detail feature's lookup helpers.

Known real test wallets (see `classic-art-editor-test-wallets` in the assistant's memory, or just use these): `0x01cB023186CAB05220554EE75b4D69921DD051f1` (owns layers 483/487/488/1181), `0x762dA606029d3120735Aa1EeC15464E265Db7A3C` (owns master 1178).

## Known environment quirks (not bugs to fix, just friction)

- This sandbox's headless Chromium fails to negotiate QUIC against some external hosts (IPFS gateways, occasionally others) — launch Playwright with `args: ['--disable-quic', '--disable-features=QuicProtocol']` to work around it. `curl` is unaffected, useful for a first sanity check when Playwright navigation stalls.
- Full artwork compositing (loading all layers from IPFS) can legitimately take 60-110 seconds even when nothing is wrong — this is inherent to the art, not a bug, and is why `ArtworkLoader` (`src/components/artwork/artwork-loader.tsx`) has a "can take up to two minutes" notice.

## Ideas for future feature work

- Extract the 3x-duplicated `ownerOf` read pattern into the existing `getTokenOwner` helper (see Contract interaction conventions above).
- ENS avatar (`viem`'s `getEnsAvatar`) alongside the name in `AddressWithEns`, if wanted — same `/api/ens` route could return it in one extra call.
- The Layer Detail popup's shareable-URL mechanism (`history.pushState`/`popstate`, not real Next.js routing) was a deliberate simplification over true Next.js parallel/intercepting routes — revisit if browser-native back/forward integration with Next's own router ever becomes worth the added complexity.
- `src/artwork-overrides.json` is the extension point for any other masters that don't composite reliably — no code changes needed, just add an entry (see item 14 above).
- GREYSCALE control mapping (item 10) is explicitly best-effort — worth a real design pass if a GREYSCALE-controlled layer is reported looking wrong.
