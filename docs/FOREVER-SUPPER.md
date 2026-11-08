# Forever Supper restoration

The collection page restores the original empty-room render recovered from
Wayback's April 16, 2023 capture, and groups 1,242 CID-verified expansion
metadata records by the production core address and original slot names.
Open Book, Open Book Tester and Forever Supper ProdTest are excluded.

The September 26, 2023 collection page supplies the complete original 32-slot
layout, 4800×3840 dimensions, blending rules and source CIDs. Exact extracted
Next page-data bytes and four dated edition metadata snapshots are preserved
under public/archive/forever-supper. recovery.json records source URLs and hashes.
The layout is a historical capture, not a newly fabricated IPFS document.

A read of blueprint() reports 1,884 mints. See recovery.json for the block.
These are distinct from the count of expansion metadata records.

composeSupper implements the old renderer's slot replacement order and blending,
rejects foreign-core items and overlapping selections, and keeps original full
canvas source references. It is deliberately not connected to an interactive
renderer until the separate base PNGs can be retrieved and decoded. The archived
JPEG cannot faithfully replace individual base layers.

The old routes/dynamicBlueprints/renders.js validates item ownership, requests a
wallet signature and stores appliedItems in the backend database. These choices
are not recoverable merely from ERC721 ownership. No apply transactions, signature
requests, minting or latest-state claims are enabled by this release.

Next: recover the base PNGs (listed in core-layout.json), verify their dimensions
and blends, recover expansion token identities and signed collector selections,
then enable a faithful local composer before wallet-controlled persistence.

## User ZIP and OpenSea recovery

The supplied forever_supper.zip contains 1,418 metadata JSON wrappers and a
manifest, with no image binaries. All 1,418 imported metadata documents were
compared with the ZIP and matched. Of those, 1,242 use the production Supper
core. See public/archive/forever-supper/zip-audit.json for hash and core counts.

OpenSea still exposes cached edition renders and 35 traits (32 layer choices
plus Artist, Asset Type and Collection). Five editions (1, 14, 95, 156, 434)
were recovered through their visible pages, with exact CDN URLs, observation
times, image dimensions and SHA-256 hashes recorded separately from Wayback.
The downloaded PNGs are 500 by 400, even with the supplied w=1000 URL. These
are cached marketplace snapshots with unknown last-update dates, not full-size
original layers or verified current collector selections.

Matching uses slot plus label against production-core expansion records. If
multiple records imply different source layers, the selection remains unresolved.
Historical and OpenSea records are preserved separately rather than overwritten.

## Collection model

Forever Supper has individual collector-owned core editions, not one shared
master composition. Collectors obtain expansion items from NFT packs and arrange
them in their own core room, including changing the background. The recovered
default empty-room render is a starting template, not a definitive collection
artwork. Restoration should recover each edition's arrangement separately and
eventually allow its owner to apply eligible owned items to that core. Keep local
previews separate from persisted collector choices and never overwrite one
edition with another collector's composition.
