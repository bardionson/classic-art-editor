# Archive navigation and discovery

The public site preserves existing Async works. The home page leads to Classic,
Music, Blueprints, and Dynamic Blueprints. The latter two expose recovery records
before dedicated artwork viewers are ready. Music discovery does not imply audio
playback has been restored.

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
not a complete on-chain census. Only the 24 successfully retrieved and
CID-verified documents receive the metadata verification label. This label
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
