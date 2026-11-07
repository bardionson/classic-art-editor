# Archive navigation and discovery

The public site preserves existing Async works. The home page leads to Classic,
Music, Blueprints, and Dynamic Blueprints. Blueprints and Dynamic Blueprints now show illustrated recovery catalogs and
individual original-media previews. These are previews, not restored generative
or evolving compositions. The 17 identified Classic Music masters have a browser
stem player; original mastering remains pending.

## Search snapshot

Run `python3 scripts/build-archive-index.py /path/to/automation-audit` to rebuild
the server-side index. Inputs are the existing masters/layers catalogs, the
community sheet inventory, the supplied project manifest and Supper pin list,
and the metadata retrieval evidence. Original source files stay outside the app.
The generated index contains public artwork fields, not archive filesystem paths
or private contacts. Search returns 24 records per page; the complete index is
not shipped to the browser. A redeployment is needed after rebuilding it.

Identity joins use contract/token pairs or exact metadata CIDs, never titles.
Existing catalog identities are deduplicated. The builder reports two catalog
Master/Layer conflicts (#1248 and #1249); the community inventory identifies both
as Masters. The underlying catalogs are preserved for separate review.
Recovered metadata variants remain distinct when their CIDs differ.

The supplied manifest classifies 9,065 edition records as Blueprints. The supplied
Supper pin list classifies 1,418 candidates as Dynamic Blueprints, including test
and unresolved core deployments. These classifications are reported evidence,
not a complete on-chain census. Successfully retrieved documents that pass the supported original CID check
receive the metadata verification label. The initial 24 Supper documents are now
joined by an additional bounded preview recovery batch. This label
does not imply their media or interactive behavior has been restored.

Known music masters/stems are classified from the community inventory. Its 17
music masters agree with local master metadata CIDs and populate the Music
gallery. Reported artist text is retained; encoding and attribution corrections
remain a separate evidence-based task. Unclassified records are searchable.

## Recovery mappings

Missing original metadata may be reconstructed from surviving images, layer
assets, contracts, source code, and historical captures. Store the original URI,
replacement URI/CID, evidence for each recovered field, remaining unknowns,
and review status. Preserve originals and never serve altered bytes while
claiming that they verify against the original CID. Do not turn an IPFS gateway
failure into an automatic fabricated metadata fallback.

Next, connect a reviewed mapping to the shared metadata loader and validate
the resulting display against independent evidence. Reconstruction is not
implemented by this navigation/search release.

## Neon and future remix fundraising

The user has authorized Neon if persistence is needed. A future catalog database
can store canonical identities, metadata variants, dependencies, recovery
mappings, and resumable jobs. This release needs no database migration or new
paid service. Keep public search read-only and recovery writes authenticated.

New original creation is outside the archive's scope. A possible future remix
minting system is separate: artist-authorized layer sources, explicit remix
attribution, saved composition/state, durable metadata and media, and a new
mint contract with an agreed proceeds split. Original ownership and archive
state must remain intact. No minting, payment, or new creation flow ships here.

## Illustrated discovery and Blueprint previews

The index now retains existing catalog image references and image/collection
fields extracted from preserved metadata in `preview-metadata` and
`supper-metadata`. No metadata is rewritten or served under a false CID.
Run `python3 scripts/recover-archive-previews.py /path/to/automation-audit --limit 96`
to resume bounded metadata recovery, then rebuild the index. Recovery uses four
workers and stops scheduling new fetches after rate limiting. Unretrieved entries
remain discoverable. Re-run after gateway cooldown, not in an immediate loop.

The first batch retrieved 33 additional original documents before a gateway rate
limit; all 33 passed the single-block UnixFS CIDv0 check. Original bytes and a
SHA-256/source report remain in the local audit directory. Other IPFS import
layouts require a separate verifier and must not be marked verified automatically.

`/api/archive/preview` accepts only exact metadata CIDs already in the index and
fetches only fixed HTTPS IPFS gateway URLs. Responses are limited to 2 MB and
7 seconds per gateway, with a 30-second route limit. Only validated image fields
are returned; animation HTML, scripts, inline SVG and arbitrary metadata URLs
are never embedded. Successful metadata fetches/previews have a one-day cache;
temporary failures are not cached as permanent loss. Browser lookups are lazy,
limited to four concurrent requests, and memoized with a bounded per-tab cache.
Images try three gateways with error/timeout fallback; original animations are
preserved by using ordinary image elements rather than optimized still images.

Search handles titles, artists, collection names, blueprint identifiers,
token IDs, contract addresses, classic/layer URLs, and exact metadata or indexed
image CIDs. CIDv0 remains case-sensitive. Punctuation and diacritics are normalized
for text only. Exact identities rank above names, artists, and description terms.
Family counts are calculated before family/stage narrowing. Pagination preserves
the query and both filters. The full index stays on the server.

Restoration-stage filters deliberately describe evidence in the snapshot:

- Artwork page available: a dedicated viewer route exists; behavior may vary.
- Preview indexed: an image reference is indexed, but the dedicated viewer is pending.
- Metadata indexed: image retrieval is attempted on demand, not yet incorporated
  into the snapshot. A successful on-demand display does not silently rewrite this
  status; rebuilding from recovered original bytes updates the index.

Metadata CID verification, reported token identity, image availability and dynamic
behavior are independent. Blueprint preview pages explain that unrevealed or
historical images may survive and that Dynamic Blueprint expansion items are not
the assembled core. No fabricated metadata, new minting or database is introduced.

## Blueprint project browsing

Blueprints opens a paginated project directory (201 reported project IDs covering
9,065 indexed editions in the current snapshot). Grouping uses the manifest's
blueprint ID, never a title or shared minting contract. Distinct project IDs remain
separate even when their names match. Counts are indexed records, not minted supply.

Project labels prefer recovered collection metadata; otherwise they use the most
common edition title with a trailing edition number removed. The project information
disclosure identifies this fallback. A representative edition with an indexed image
is preferred for the project cover; otherwise original metadata is resolved on demand.

The project directory supports artist/title search, largest-first or alphabetical
sorting, and 24 projects per page. Each stable `/archive/blueprints/project/[projectId]`
route has an edition gallery, scoped search, and 24 records per page. Global search
still returns individual editions, now with links to their parent project. Preview
pages return to the project gallery. Dynamic Blueprint expansion browsing is unchanged.


## Supplied Forever Supper ZIP recovery

The supplied ZIP contains 1,418 CID-keyed JSON exports plus a duplicate path manifest
and macOS bookkeeping. `scripts/import-supper-zip.py ZIP AUDIT_DIRECTORY` unwraps
each JSON, reconstructs compact serialization, and accepts bytes only when the
single-block UnixFS CIDv0 hash matches the original filename. All 1,418 passed;
none required invented metadata. Original ZIP bytes, SHA-256 provenance, entry
names and per-document encoding/hash records remain in `supper-zip-import.json`
and the audit sources directory. ZIP paths are never extracted or executed.

Rebuilding the index verifies the recovered bytes again and publishes exact copies
under `public/archive/metadata/<CID>.json`. Artwork pages link these preserved
copies, retain their original gateway links, and display the metadata-declared core
contract and slot. Image references, collection names and slot text enter search.
An indexed image reference does not establish current media availability.

The metadata declares four separate cores:

| Collection | Core contract | Records | Distinct slots |
| --- | --- | ---: | ---: |
| Forever Supper | 0xf62d291a22886fa0b81e5b13c7b6dab2d4c33f31 | 1,242 | 24 |
| Forever Supper (ProdTest) | 0x3906a4f3d76b593a78081b2b059c32d2cb2bd26b | 26 | 9 |
| Open Book | 0x7fa01ab463cd1e5e1de309c3da5144277449d670 | 63 | 6 |
| Open Book Tester | 0x0b8425daec0153c04d8b29c11b5b8d953935a26c | 87 | 8 |

The recovered objects reference 1,786 distinct asset CIDs. Asset availability,
expansion token identities, core layout/draw order and current on-chain selections
still require verification before rendering a faithful changing composition.
Collection titles, shared descriptions or folder names must not merge these cores.
The metadata recovery does not claim that composition or automation is restored.


### Video expansion previews

Forever Supper Remix uses an MP4 asset in its `image` field. Its exact asset CID
is recorded in `src/data/archive-media-types.json`, with gateway HEAD evidence
(video/mp4, 92,194,518 bytes). The original metadata remains untouched. Confirmed
videos use native controls and inline mobile playback on artwork pages, with no
autoplay and metadata-only preload. Gallery cards link to playback without
downloading videos. This format evidence is separate from metadata CID verification;
the original video bytes have not been independently hashed in this release.
Unknown assets still use the image preview path until their media type is checked.
