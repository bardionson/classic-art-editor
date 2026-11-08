# Dynamic Blueprint original media cache

The generated allowlist contains 1,785 exact IPFS paths: 518 original cover
paths plus 1,268 original layer-state paths, with one shared path. It derives
only from the 1,418 Dynamic Blueprint records and their preserved, verified
metadata. The two external Cloudinary cover URLs stay unchanged.
Regenerate with `python3 scripts/build-archive-image-sources.py`.

`GET /api/archive/image?path=...` checks the private R2 cache and redirects to a
six-hour signed preview URL when available, or the preserved original URL. A missing, disabled or unavailable cache redirects
to the exact original Filebase path. Responses use private/no-store; GET never
imports media. Full originals and videos remain range-capable.

`POST /api/archive/image?path=...` returns JSON with `status`, and `url` and
`contentType` when ready. It can import a missing original from fixed IPFS
gateways. It accepts no uploaded bytes or arbitrary URLs. Imports are bounded to
128 MiB, a 53-second deadline, two distributed slots, 2,000 attempts per hour,
and a two-minute per-path cooldown. Image controls have their own R2 namespace
and do not consume the audio import budget. Browser previews queue at most two
warm requests and try each path once per tab, including on busy/failure.

Imports require full HTTP 200 bodies, enforce declared/streamed length limits,
and sniff PNG, JPEG, GIF, WebP, AVIF, MP4 or WebM signatures. HTML, SVG, partial
responses and unrecognized data are rejected. Bytes are retained unchanged,
including GIF animation and transparent layer states. R2 provenance includes
the exact IPFS path and downloaded-byte SHA-256; existing unrecognized objects
are never overwritten or signed. Only matching path, positive bounded length,
supported MIME and verified provenance can be served from cache.

Uses the existing `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, and
`R2_SECRET_ACCESS_KEY` connection. Object keys begin `archive-images/v1/` and
controls use `archive-images/control/v1/`. Do not log signed URLs or credentials.

A cache can preserve an available original; it cannot recover unavailable IPFS
content. Expansion layer states must remain visibly distinct from original
pack covers, and must be associated through their own exact metadata.

## Static image browsing copies

Static PNG, JPEG and WebP originals receive a separate WebP browsing copy at
`archive-images/preview-v1/<path>.webp`. Sharp rejects inputs above 40 million
pixels, removes only fully transparent outer padding using the alpha > 0 bounding box,
then fits that complete content inside 1200 by 1200 pixels without enlargement.
Every nontransparent pixel remains within the frame; opaque uniform backgrounds
are never trimmed. It preserves transparency and uses WebP quality 85. Animated inputs,
GIFs and video retain their originals. Derivatives are limited to 8 MiB.

The original object's bytes, full canvas/placement and SHA-256 stay unchanged. Each derivative retains
its own checksum plus the original path and checksum. A cached derivative is
served only when those fields match the preserved original. POST can generate
a missing derivative from a checksum-verified existing R2 original under the
same import limits. Decode/storage failures fall back to the preserved original.
GET defaults to a ready derivative; `original=1` explicitly serves the original.
The artwork's “Open original media” link uses that flag. POST reports the served
`contentType` and `variant` (`preview` or `original`).
