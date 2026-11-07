# Archive audio delivery

The Vercel app uses the existing private `asyncart` R2 bucket. No DNS migration or public bucket is required.

## Configuration

Server-only Vercel environment variables:

- `R2_ENDPOINT`: S3 endpoint origin, without the bucket name
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

The R2 token needs Object Read & Write scoped to this bucket. Never use NEXT_PUBLIC variables for credentials. Existing `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` provide shared import limits; if Redis is unavailable, existing R2 copies still play but new imports fall back to IPFS. Redeploy after changing environment variables.

The bucket CORS policy must permit GET/HEAD from https://async.art and https://www.async.art, allow the Range header, and expose Content-Length, Content-Range, Accept-Ranges, and ETag. Include https://asyncart-revival.bardionson.com if that app uses these files.

## Behavior

`src/data/archive-audio-sources.json` is a reviewed allowlist derived from the recovered classic master audio layouts and local Blueprint Music metadata. It stores original metadata references with every audio path. This initial snapshot contains 332 unique audio paths, not 332 works, and does not represent every historical Blueprint edition.

- Download-first playback checks the persistent browser cache, then POSTs to `/api/audio?path=...`.
- Existing R2 copies receive a fresh six-hour signed GET URL. Bytes travel directly from R2 to the browser.
- Missing copies are imported from fixed IPFS gateways, then signed. Imports have a 96 MiB file limit, a 53-second overall operation deadline, two shared slots, 120 attempts per hour, and a two-minute per-file cooldown. Files that cannot be imported continue through the original IPFS fallback.
- GET `/api/audio` only checks existing objects. `/api/audio/stream` redirects to an existing signed copy or the original IPFS gateway. Streaming alone does not import files; prewarming makes these copies immediately available.
- Objects live under `archive-audio/v1/<original IPFS path>`. Conditional writes prevent overwriting. Original IPFS path and downloaded-byte SHA-256 are saved as object metadata. This is a mirror of gateway bytes, not an independently verified UnixFS CID reconstruction.
- Complete downloads and recognizable audio headers are required; HTML, JSON, partial responses and oversized files are rejected. Unsupported formats keep IPFS fallback.
- Original artwork, token metadata, stem selections and original-media links remain unchanged. Signed URLs are never persisted in the catalog or browser cache. The browser cache remains keyed by immutable IPFS path.

## Prewarm and verify

Run from the checkout after deployment (no local R2 credentials required):

```sh
node scripts/warm-audio.mjs --base=https://async.art --token=1597
node scripts/warm-audio.mjs --base=https://async.art --blueprints
```

The script imports serially and reports readiness, MIME, HTTP byte-range support, and CORS without printing signed links. `--all` attempts the full allowlist, subject to the shared import budget; rerun later to retry unavailable objects. Optional `--report=/path/to/report.json` records results. Unknown archive paths cannot be imported through this service.

This provides shared object storage and per-browser caching, not a shared CDN cache. Large files may need a separate offline uploader. Adding more recovered audio requires updating the allowlist with its original metadata provenance.
