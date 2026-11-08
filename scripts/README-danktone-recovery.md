# Danktone recovery import

The recovery export contains 1,790 original metadata records with exact CIDv0 and SHA-256 verification, plus 26 extra token records fetched from their exact `tokenURI` paths and verified against their per-file CIDs. No images, audio, or animation media are downloaded by this import.

From the app repository, run the staging-only mode first:

```sh
python3 scripts/merge-danktone-recovery.py --stage-only
```

This writes `public/archive/recovery/danktone-metadata.json` and copies the exact verified metadata bytes to `public/archive/metadata/<file-CID>.json`. It does not edit the app catalogs.

To merge the staged records into the app catalogs, run:

```sh
python3 scripts/merge-danktone-recovery.py --apply
```

The merge updates only the seven target projects in `src/data/archive-index.json`, `src/data/music-blueprint-metadata.json`, `src/data/archive-audio-sources.json`, `src/data/music-blueprint-projects.json`, `src/data/artist-profiles.json`, and `src/data/blueprint-project-coverage.json`. It reads only the staged recovery report and files, rechecks CID and SHA-256 before applying, preserves unrelated records, and refuses conflicting edition identities or metadata bytes. Manifest-only rows retain reported identity status; only the 26 extra rows use tokenURI verification evidence. Project coverage is added only when verified metadata token IDs exactly equal a complete mint-log scan. H0m3 contract counts remain contract-only evidence, and S1E0 and S1E4 receive no project-level minted-count coverage.
