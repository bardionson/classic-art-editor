# Shared Music Blueprints contract recovery

Reviewed 2026-11-07.

The shared Ethereum contract `0x71925638b9998ab631c83873d9ed19ef9b70ecf0`
returns `Async Music Blueprints` from `name()`. OpenSea lists 4,002 collection
items at https://opensea.io/collection/async-music-blueprints. This is a reported
marketplace count, not independently enumerated live supply (`totalSupply()`
did not return a value in this audit). Token IDs are not assumed contiguous.

The recovery inventory contains 48 distinct token identities on that contract,
across 13 projects. Seven projects were missing from the music classification.
Their original IPFS metadata was retrieved through Filebase and matched as JSON
against each token's current on-chain `tokenURI` directory file. Each original
animation asset returned audio/mpeg with an ID3 header. Original metadata bytes
are preserved under public/archive/metadata; no metadata was invented.

Recovered project / token:

- Exo Orb / 18449
- cr0 by G3ARZ / 12697
- Better Way / 13855
- Yoga & Music / 18111
- Any body? / 1459
- The Syndicate / 4249
- Slip Away / 4548

Music Blueprints now groups 1,673 recovered edition records in 21 projects,
including other contracts and inventory with unresolved identities. These
totals must not be presented as coverage of the 4,002-item shared contract.
Each recovered edition uses its own original media, registered with the existing
audio-cache pipeline. Media-header availability is not full playback validation.

Next recovery work: enumerate minted token IDs from contract events or a paginated
NFT index; reconcile by chain + contract + token ID and metadata CID; retrieve
tokenURIs and original media; group by metadata project ID/Collection; deduplicate
aliases without overwriting archival provenance; verify audio through completion.
Keep editions on other music contracts and historical project evidence in scope.

## Additional edition recovery

The follow-up batch recovered all 203 missing original metadata files among the
220 inventory records outside Danktone 003. Exact bytes match their CIDv0 UnixFS
hashes. Horizons by Genzo was independently recovered from shared-contract token
14104: on-chain tokenURI directory file `QmQQA5qci4BVGmXPdrjZ7RtLSF8yyepPSHS9woKc73YUML/14104/token.json`,
with exact metadata file CID `QmQ2o4LoGsUy6qPkxMwFMZqXdNb4ePLpWaxQsdZXpdGwMU`.
The collection now groups 1,674 inventory records in 22 projects; 222 have
preserved original metadata, including the existing Danktone 003 sample.

The batch adds 193 exact IPFS audio source checks, including Horizons. All
returned recognized MP3 headers; shared audio assets retain every metadata
reference. Three legendary editions instead reference original Cloudinary MP4
URLs that currently return HTTP 404; their exact URLs are preserved without
replacement. Header checks do not establish complete playback.

Detailed per-CID hashes, chain provenance, source checks and outstanding failures
are in `MUSIC-BLUEPRINT-BATCH-RECOVERY.json`. Remaining metadata work includes
1,452 inventory records in Danktone 003 and editions beyond the local inventory.
