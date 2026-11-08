# Dynamic Blueprint expansion images

The 1,418 recovered, CID-verified metadata documents reference 520 distinct
cover URLs (518 IPFS paths and two Cloudinary URLs), but many covers are shared
pack previews. Each document also declares one individual expansion layer under
`async-attributes.dbpTypes[].layers[].state.uri`.

The gallery and item pages now display that exact declared layer, labeled
“Expansion layer detail.” These 1,418 associations reference 1,268 distinct
layer assets. The original cover remains linked on the detail page. No metadata
bytes, contract state, layer ordering, or core composition are rewritten.

`scripts/build-dynamic-expansion-media.py` rebuilds the per-metadata association
map and retains the SHA-256 of each source document. Tests compare every mapping
to the preserved original metadata, including its complete declared layer list.

On 2026-11-08 UTC, byte-range requests confirmed 245 individual layer assets:
244 PNGs and one JPEG. Filebase rate limits prevented verifying the remaining
1,023 assets in that pass; they are pending retrieval, not proven missing.
Two additional original cover assets were confirmed as MP4s. Exact URLs,
signatures, sizes and timestamps are recorded in
`DYNAMIC-EXPANSION-MEDIA-EVIDENCE.json`. These format checks are not independent
full-file CID verification.

R2 caching and smaller previews are described in `ARCHIVE-IMAGE-CACHE.md`.
Original files remain available through the original-media link. Small previews remove only fully transparent outer margins so the item is visible.
The untouched original retains its canvas and placement in the core artwork. Assembling the changing
core from current owned selections remains separate restoration work.
