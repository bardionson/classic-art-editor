# Archive audio delivery

The Vercel app uses the existing private `asyncart` R2 bucket. No DNS migration or public bucket is required.

## Configuration

Server-only Vercel environment variables:

- `R2_ENDPOINT`: S3 endpoint origin, without the bucket name
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

The R2 token needs Object Read & Write scoped to this bucket. Never use NEXT_PUBLIC variables for credentials. Small control objects under `archive-audio/control/v1/` provide shared import limits using atomic conditional R2 writes. No Redis or additional database is required. If coordination is unavailable, existing R2 copies still play and new imports fall back to IPFS. Redeploy after changing environment variables.

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

## Mobile streaming copies

LEAVING (#1605) has 22 preserved WAV variants. The player now prefers small
AAC-LC 128 kbps stereo M4A listening copies with fast-start metadata. All six
selected layers still play together; originals remain available through Download.
`/api/audio/stream` redirects directly to the derivative in R2 when present,
and falls back to the original if unavailable. `/api/audio` still serves originals.

`src/data/archive-audio-optimized.json` records the exact SHA-256, size, duration,
original SHA-256 and original size of each verified derivative. These files were
encoded with FFmpeg 8.0.1 (`-map 0:a:0 -c:a aac -b:a 128k -ar 48000 -ac 2
-movflags +faststart`), fully decoded to check integrity, and checked for duration
differences below 0.1 seconds. Original files are never overwritten.

After deploying the manifest, POST the matching binary file to
`/api/audio/optimized?path=<original IPFS path>`. The endpoint accepts only exact
committed hashes and lengths, caps bodies at 4 MiB, uses the shared import limiter,
and writes conditionally to `archive-audio/stream/aac-v1/<sha256>.m4a`.
GET only checks availability. This is a bounded archive import, not arbitrary
public uploads. R2 credentials remain on the server. No audio binaries are in Git.
Objects include original provenance and codec metadata; reads verify this metadata
and size before signing a six-hour URL. R2 serves byte ranges directly for seeking.

To add more pieces, prepare and verify their derivatives, review and commit the
new manifest entries, deploy, upload the exact files, and test playback and ranges.
Never assign a derivative the original file's CID or change archived metadata to
claim that its bytes are original.
