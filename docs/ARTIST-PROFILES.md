# Restored artist profiles

The artist directory at `/artists` publishes 369 creator identities from the
sanitized Wayback recovery export. Profile routes accept the archived username,
an unambiguous alias, or the exact wallet address. Original `/u/:username`,
`/u/:username/collection`, and `/u/:username/creations` URLs redirect to the
restored profile. Unknown or ambiguous identities return 404.

Only historical creator flags/counts or preserved metadata artist-address
evidence qualify a profile for this release. Collector-only and unclassified
profiles are excluded. Biographies are plain text, external links accept HTTP(S)
only, and social links must use the corresponding social host. The source
capture date and Wayback link remain visible. No current verification badge or
ownership claim is inferred.

289 recovered custom portraits are served locally. Their SHA-256 digests and
archive provenance are retained; browser-compatible derivatives are used where
needed. The original metadata and source captures remain unchanged.

Work associations retain their basis:

- `metadata-wallet`: original metadata `async-attributes.artists` contains the
  profile wallet.
- `archive-credit`: the full archive artist credit exactly matches one profile
  name/username from its captures, after reversible Latin-1/UTF-8 encoding repair, NFKC case folding and edge trimming.
  Ambiguity is checked across all 1,147 recovered identities, not just creators.
  Collaboration credits are never split, accents are not removed, and name
  matches are described as archival attribution rather than wallet verification.
- `layer-contribution`: a linked layer explicitly references a master metadata CID
  on the same contract. The layer record ID is retained as evidence; this credits
  participation, not sole authorship of a collaborative master.

Blueprint editions are grouped by project ID. Other works are paginated. Counts
refer to the recovered inventory, not original minted supply. Profiles with no
linked works remain available with an explicit recovery message and archive
search link. Artist links also appear in search results, metadata pages, and
Blueprint project pages; a directory entry is on the home page and navigation.

Regenerate with `python scripts/import-artist-profiles.py RECOVERY_DIRECTORY .`.
The recovery directory must contain `profiles.json`,
`artist-profile-candidates.json`, and `portraits/`. The importer copies only
allowlisted fields, verifies portrait bytes, and does not read raw HTML captures
or publish internal session fields. Re-run after expanding metadata recovery.
