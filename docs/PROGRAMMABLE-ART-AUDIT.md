# Programmable art review checklist

Audit: 2026-11-09T01:17:01.786612+00:00

2561 works/groups listed; 2115 metadata timers. 2552/2561 master metadata files read.

115,570 state-selection cases; 50,616 hourly live-refresh checks. 2114 timer checks passed; 1 needs date review; 0 timer failures.

Open the searchable inventory: https://www.async.art/about/inventory

- Every classic/music Master record in the current catalog was attempted; this is not a complete on-chain census.
- Timer simulations exercise state selection, leap/non-leap calendar dates, UTC offsets, scheduled dates and hourly open-page refresh.
- Media checks read image signatures only. They do not prove complete decoding or visual fidelity.
- Collector-only works and external scripts are listed for manual review; their behavior has not been certified.
- Ordinary Blueprint and Music Blueprint editions are fixed after minting and are excluded from the automation count. Forever Supper is listed separately.

| Work | Artist | Mechanics | Validation |
| --- | --- | --- | --- |

Full data and review links: `public/archive/programmable-audit.json`.

Repeat timer validation with PROGRAMMABLE_INVENTORY pointing to the census JSON and PROGRAMMABLE_RESULTS to an output file: `npm test -- scripts/validate-programmable.test.ts`. Metadata is preserved in the local recovery workspace, not copied into the deployed app.

Media audit: 15,197/15,197 unique timer image references returned PNG/JPEG/GIF/WebP signatures after retries. Only 32 bytes read per response; complete decoding and visual fidelity remain unverified. No R2 cache writes were made.

Repairs: #567 timed opacity and #571 legacy GMT-06:00 timezone. Remaining date review: #786. Catalog #3207 has malformed identity data and is explicitly marked unverified, despite its CID passing timer logic.
