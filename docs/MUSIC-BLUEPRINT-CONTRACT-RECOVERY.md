# Music Blueprint restoration

Updated 2026-11-08. Original JSON is preserved byte-for-byte under
`public/archive/metadata`; recovery reports retain SHA-256 and CID evidence.
No replacement collector mix or invented NFT identity is used.

## Shared contracts

Ethereum mint logs and tokenURI calls through block 26,371,661 identify 4,002
distinct ever-minted tokens across two contracts, in 54 projects:

- V1 `0x71925638b9998ab631c83873d9ed19ef9b70ecf0`: 621.
- V2 `0xbc402bed62c90afd0e104be32bdee9447b5ccd0d`: 3,381,
  including the previously restored 3,000 Dream Recorder editions.

Both contracts have empty bytecode at the scan's starting block 14,000,000.
These are historical mint counts, not claims about current unburned supply.
All 1,002 non-Dream editions now have CID-verified original metadata and their
own media references. Detailed provenance is in `music-shared-contracts.json`
and the per-project `music-PROJECTID.json` reports under public/archive/recovery.
The Binaural Brainwave Machine has 155 minted editions; its announced cap of
3,000 is not its minted count.

## Senses and JANUS

Senses has 717 ever-minted editions (tokens 0–716) on
`0x70a5a21d938c21de21ad7031830c85d4bee3feff`, project
`629f959b98bb125d8871aa7f`. All 717 original metadata files are recovered,
with exact on-chain tokenURI and file-CID/hash checks. All artwork passed retrieval checks.
684 edition audio references were available; 33 original Cloudinary audio URLs
returned HTTP 404 and remain explicitly marked for recovery. The edition gallery,
search, artist links and individual original mix references are restored.
The original project preview remains accessible separately.

JANUS' two original project layouts, artwork and preview audio are preserved.
The preview is explicitly labelled as a project preview, not a minted edition.
No JANUS collector edition has been identified. Checks of both shared music
contracts and a bounded launch-period scan of the shared visual contract did
not establish an edition identity. `janus-contract-window.json` records the
later window (14,940,001–15,140,000): 1,386 tokenURIs, 79 representative root
metadata records. A sample per root is discovery evidence, not proof that the
project never minted. Do not infer minted supply from the announced cap of 250.

## Danktone and separate edition contracts

1,790 manifest originals plus 26 previously unindexed tokenURI-verified editions
are preserved in `danktone-metadata.json`. Danktone 003 now has 1,478 indexed
editions and Danktone 005 has 66. Remaining manifest identities are explicitly
reported, not upgraded to independently verified chain identities. Project
signature addresses must not replace edition contract addresses: some differ.
The 12 indexed H0m3w0rk records do not imply complete coverage of its contract.

## Playback and media limits

Every restored edition uses its own animation_url; missing media is never
replaced with another edition's mix. The player displays art beside native
audio/video controls. Gallery Listen links choose editions without known media
gaps. JANUS preview and Senses #0 were checked playing in a browser past 22 and
28 seconds respectively, without media errors. These are representative checks,
not claims that every track was listened to end-to-end or tested on an iPhone.

The media audit reports perform bounded 512-byte retrieval and format checks;
they do not verify complete file integrity. Original Cloudinary URLs returning
404 and failed gateway retrievals are retained and labelled for recovery.
Public gateway timeouts do not prove content is missing from IPFS.

Playback uses the existing R2-first delivery path where a cached copy exists,
then public gateways. This restoration does not bulk-import media into R2.
The current Download preparation path can import allowed original audio;
pressing Play alone does not guarantee creation of a shared R2 copy.

## Rebuild and validation

After rebuilding archive-index, run `scripts/merge-blueprint-recovery.py`,
then `scripts/merge-danktone-recovery.py --apply`. Regenerate artist profiles
and their small link index from the existing sanitized recovery export.
Do not format original metadata JSON; whitespace changes alter its CID.

Tests cover project classification, unique token identities, exact original
audio references, original metadata hashes, search/pagination and player media
handling. Run the production build before deployment.
