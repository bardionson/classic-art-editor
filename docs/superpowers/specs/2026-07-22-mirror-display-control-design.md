# Mirror Display/Control Feature — Design

## Context

Artwork rendered by classic-art-editor is currently only viewable/adjustable in a single browser session: the same page shows the composited artwork and the layer-control sliders that change it. For gallery/event display purposes, we want to show the artwork fullscreen on a large display (e.g. a TV) while a separate device (a tablet) is used to adjust the layer controls, with changes reflected live on the display. The two devices pair using a shared code word rather than any account/login system, since this is meant for casual, in-person use at a gallery or event.

## User Flow

1. A user browses the gallery and opens an artwork on the existing art page (`/[version]/[id]`).
2. They click a new "Mirror" button (alongside the existing Layers/Fullscreen buttons). A dialog asks for a code word.
3. On submit, this device becomes the fullscreen **display** for that code word (assuming no other display is already active for it), and navigates to a fullscreen view.
4. On a tablet, the user opens the same artwork's art page, clicks "Mirror", and enters the **same** code word. Since a display is already active for that code, this device instead becomes the **control** and navigates to a controls-only page.
5. Adjusting a layer control on the tablet updates the artwork shown on the display within about a second.
6. Either device can end the session via a "Stop Mirroring" button. Idle sessions (no activity from either side) auto-expire.

## Data Model

A Redis-backed (Vercel KV) session keyed by the code word:

```
mirror:{code} -> {
  tokenAddress: Address,
  tokenId: number,
  controlOverrides: Record<string, number>,
  displayLastSeenAt: number,  // epoch ms
  controlLastSeenAt: number | null,
}
```

- TTL is refreshed (sliding window, e.g. 60 min) on every read/write, giving automatic expiry for abandoned sessions.
- Liveness for role negotiation uses a shorter staleness threshold on `displayLastSeenAt` (e.g. 20s of no polling) independent of the outer TTL.

## Mirror Entry Point

The "Mirror" button is added to `ArtworkViewer`'s existing floating button cluster (`src/components/artwork/artwork-viewer.tsx`, alongside the Layers/Fullscreen buttons around lines 207–220), so it's available from both the standalone art page and the gallery modal viewer. Clicking it opens a `Modal` (reusing `src/components/common/modal.tsx`) containing a code-word text input and a submit button. On submit, `ArtworkViewer` POSTs to `/api/mirror/[code]` with its own `tokenAddress`/`tokenId`, reads the returned `{ role }`, and calls `router.push` to `/mirror/[code]/display` or `/mirror/[code]/control` accordingly. This dialog and its submit handler are net-new — no existing button/hook covers it.

## Routes

- `src/app/mirror/[code]/display/page.tsx` — fullscreen display.
  - On load, GETs the session for `tokenAddress`/`tokenId`.
  - Renders the existing `ArtworkViewer` fullscreen, passing a new controlled `controlOverrides` prop.
  - Polls GET every ~1s to pick up control changes and to heartbeat `displayLastSeenAt`.
  - On 404 (session ended/expired), shows an ended-session state with a link back to the gallery.
- `src/app/mirror/[code]/control/page.tsx` — tablet controls.
  - On load, GETs the session for `tokenAddress`/`tokenId` (role=control), to know which layers/controls to show.
  - Renders the existing `LayerControlList` + `LayerControlDialog` for that token.
  - `LayerControlDialog`'s `onPreview` callback is wired to PATCH the session's `controlOverrides` instead of local state.
  - Polls/heartbeats `controlLastSeenAt` the same way.
  - Has a "Stop Mirroring" button (DELETE).

## API

Single dynamic route `src/app/api/mirror/[code]/route.ts`:

- `POST` (join): body `{ tokenAddress, tokenId }`.
  - Claim/stale-check and write must be atomic (a single Lua script executed via `EVAL`, or Redis `SET ... NX` plus a follow-up check) so two near-simultaneous joins for the same code can't both win as display or clobber each other. The script: read existing session; if absent or `displayLastSeenAt` older than the staleness threshold, write a **fresh** session — `{ tokenAddress, tokenId, controlOverrides: {} }` (overrides always reset on a new display claim, never inherited from a stale prior session) — with `displayLastSeenAt = now`, and return `display`. Otherwise, update `controlLastSeenAt = now` on the existing session and return `control`.
  - Response: `{ role: 'display' }`, or `{ role: 'control', tokenAddress, tokenId }` (from the existing session — the joining device's own token selection is ignored in the control case).
  - No cap on the number of simultaneous control joins — a third or fourth device joining an active code also becomes another control, each able to push overrides. Acceptable for casual gallery use; not enforced.
- `GET ?role=display|control`: returns current session state; touches the corresponding `lastSeenAt` field and refreshes TTL. 404 if the session doesn't exist (including if it expired).
- `PATCH`: body is a partial `controlOverrides` object, merged (additive union — existing keys are overwritten by new values, no key is ever removed by a merge) into the session's `controlOverrides`; touches `controlLastSeenAt` and refreshes TTL. 404 if the session doesn't exist or has expired.
- `DELETE`: removes the session immediately ("Stop Mirroring"). 404 if the session doesn't exist or has already expired.

## Component/Hook Changes

- `ArtworkViewer` (`src/components/artwork/artwork-viewer.tsx`): add an optional `controlOverrides` prop. When provided, it's merged into the existing internal `controlOverrides` state (existing local-preview behavior is unchanged when the prop is omitted).
- Extract the layer-list derivation currently inlined in `ArtworkViewer` (filtering `layersData` by `tokenURI`, fetching artist names and layer contract addresses) into a `useLayersWithArtists(tokenAddress, tokenURI)` hook. Reused by both `ArtworkViewer` and the new control page.
- Split `useArtwork`'s metadata/tokenURI fetch (its current "step 1") out into a `useTokenMetadata(tokenAddress, tokenId)` hook. The control page uses only this lighter hook plus `useLayersWithArtists` — it must not trigger the per-layer image compositing (`useArtwork`'s "step 2"), since that's unnecessary network/CPU load on a tablet. `useTokenMetadata` owns `error`, `metadata`, `tokenURI`, `collector`, `masterArtSize`, `artists`, and the `isComponentMountedRef` guard for its own fetch. `useArtwork` calls `useTokenMetadata` internally and passes its `error`/`metadata` through unchanged to callers — the step-2 effect keeps depending on the same `error` value, just sourced from the sub-hook instead of local state.
- `LayerControlDialog`'s existing `onPreview` callback contract is unchanged; only the caller differs (server PATCH vs. local `setState`).

## New Dependency

This feature introduces Vercel KV (Upstash-backed Redis, provisioned through the Vercel dashboard's Storage tab rather than directly on upstash.com) as a new runtime dependency — nothing in this codebase talks to Redis or any KV store today (no `@vercel/kv` in `package.json`, no existing env vars for it). Implementation must include: creating the KV store from the Vercel project's Storage tab (auto-injects `KV_REST_API_URL` / `KV_REST_API_TOKEN` / `KV_REST_API_READ_ONLY_TOKEN` into the Vercel project's env vars), pulling those into local `.env` via `vercel env pull`, and adding the `@vercel/kv` package. `@vercel/kv`'s client supports the same `eval`/scripting primitives needed for the atomic claim-as-display check in the API section below.

## Known Limitations (accepted for v1)

- If the display device re-opens the Mirror dialog with the same code while its own session is still fresh (e.g. accidental back-navigation before the staleness threshold passes), it will be misclassified as a control instead of reclaiming display. Not expected to occur in the normal flow described above.
- No authentication/authorization on code words — anyone who knows/guesses the code word can join as control. Acceptable for casual gallery/event use.

## Verification

This project has no automated test runner; manual QA is the existing convention. Verify by:

1. Running two browser sessions locally (or two devices on the same network).
2. Opening `/mirror/<code>/display` on one, then `/mirror/<code>/control` on the other with the same code.
3. Confirming layer-control changes on the control page appear on the display within ~1s.
4. Confirming "Stop Mirroring" ends the session on both sides (display shows an ended state).
5. Confirming a session with no activity expires per the TTL, and that a new code claim after expiry correctly becomes a display rather than a control.
