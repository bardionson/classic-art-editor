# Async Art restoration checklist

Updated November 8, 2026, after deployed hourly restoration commit `9104281`.

This is the current summary checklist for Digital Rescue Lab's independent restoration. Detailed reports remain in the app's `docs` folder. A restored page, recovered metadata, working media, and faithful interactive behavior are separate milestones. Counts below describe recorded recovery checks, not a new exhaustive audit.

## Next repairs, in priority order

| ID | Priority | Work | Current status | Finish when |
| --- | --- | --- | --- | --- |
| AUTO-01 | 1 | ETH Boy and Right Place & Right Time #245 | Hourly rendering implemented for #807/#245 with recorded-state switch and R2 checkpoint/replay for ETH Boy. Deployed and live APIs verified at 22:39 UTC; first ETH Boy R2 checkpoint saved and repeat request stable. | Milestone rules now implemented and original-script parity tested; verify deployment and observe an actual next-hour transition. Establish remaining historical/provider fidelity. Collector styling and wallet forms are preserved. |
| AUTO-02 | 1 | Other automated art and Tarot | Shared time-rule repairs shipped. Whole-catalog coverage and custom behavior remain incomplete. | Complete a resumable inventory, verify every identified rule type, audit calendar pieces #566/#1139, currency #1076, combo #1148, and seeded Tarot #1497/#1524. Recheck the reported revival-site Tarot gallery separately. |
| SUPPER-01 | 2 | Forever Supper original layers | Original 32-slot layout and expansion metadata recovered; base image retrieval remains incomplete. | Retrieve and decode original base layers and expansion images; validate dimensions, blend modes, and multi-slot behavior. |
| SUPPER-02 | 2 | Forever Supper individual collector arrangements | Five cached collector renders recovered. Expansion contract roster and 169 broadcast batch references found; batch contents still unresolved. | Retrieve broadcast records, establish item contract/token identities and each recoverable signed arrangement, then enable a faithful local composer. Wallet persistence is a later step. |
| MUSIC-01 | 2 | Missing Music Blueprint media | Recorded audit flags 41 affected edition entries, including 33 Senses recordings and five Dream Recorder legendary videos. | Recover original media from archives, IPFS replicas or artist backups; verify full file integrity and playback. Preserve honest unavailable status where recovery fails. |
| MUSIC-02 | 2 | Remaining music inventory | 67 projects / 6,689 editions indexed in the last catalog audit. JANUS preview recovered; edition identities unresolved. h0m3w0rk coverage and some separate-contract identities incomplete. | Reconcile contract mint logs, tokenURIs and project mappings; resolve unknown identities without treating announced capacity as minted supply. |
| MUSIC-03 | 3 | Reliable streaming across the music catalog | R2-first delivery works for existing cached files. LEAVING has 22 verified compact streaming variants. Other music is not all converted or cached. | Audit playback/seek on representative mobile and desktop devices; prepare verified compact copies as needed; add bounded cache warming and cache coverage reporting. Playing a track alone currently does not guarantee an R2 import. |
| MUSIC-04 | 3 | Original Classic Music behavior | Stem selection and linked artwork previews implemented; eligible owners can save through their wallets. | Verify original mastering/mixing fidelity, consider delegated controllers, and refresh already-open viewers after remote changes. No real collector save transaction was used as a test. |
| DATA-01 | 3 | Missing metadata, media and preservation | Original files recovered where available; provenance recorded for reconstructed controls. Filebase-first / Alchemy fallback and optional R2 image cache implemented. | Complete dependency/availability coverage, recover exact original bytes where possible, label reconstructions separately, and track storage usage. Gateway timeout or 429 is not proof of lost IPFS content. |
| DISCOVERY-01 | 3 | Search, artist profiles and catalog cleanup | Search, project grouping, profiles and artist links shipped. #115 hidden; #245 retained. | Continue resolving missing credits, project identities, duplicate/retired versions and incomplete edition coverage as evidence arrives. |
| OPS-01 | 3 | Repeatable collection-wide health reporting | Tests and recovery reports exist, but there is no complete live health dashboard. | Report per-work metadata/media/rendering/automation/playback status and last verification time; track failures without marking untested work restored. |

## Recently completed / deployed

- [x] Hourly price rendering for ETH Boy #807 and Right Place & Right Time #245. Commit `9104281`; 50 targeted tests, TypeScript and production build passed. Vercel success verified. Production APIs returned 6 ETH Boy price/date/gas overrides and 96 Bitcoin transforms at hour 2026-11-08T22:00Z. ETH Boy anchor block 26373200; repeat request retained positions 7092 / -772. Bitcoin rendering and recorded-state switch checked in desktop and phone layouts. R2 replay covers missed hours since this new anchor, not missing historical years.

- [x] Price-check page and API: current ETH/BTC prices, completed-hour inputs, original-script calculations, stale-data handling and downloadable evidence. The inspector remains calculation-only; the new viewer integration is described in AUTO-01. Commit `f44d54b`; 35 relevant tests passed; public API and page verified.
- [x] Hide Right Place & Right Time #115 from classic browsing, search and artist profile; retain #245. Preserve #115 direct page and metadata. Commit `54c5967`; 25 relevant tests passed; production links checked.
- [x] Shared metadata-driven time rules, UTC offsets, overlap precedence, live transitions and background-tab catch-up repaired. Representative fixtures are not a whole-catalog fidelity certification.
- [x] Classic Music player, visible music controls, selection thumbnails, linked art previews and LEAVING mobile streaming repaired.
- [x] Music Blueprints category, project galleries and edition players; Dream Recorder and Senses recovery; JANUS project preview.
- [x] Blueprint project grouping, archive search, artist directory/profiles/links and complete-work filter.
- [x] SAGE Anomaly catalog expanded to 97 identified minted editions.
- [x] Collapsible artwork controls and layout fixes for DOOM Party / Artificial Entity Probes.
- [x] Forever Supper archive, expansion inventory and selected historical collector compositions; interactive composition remains pending above.
- [x] Press archive, historical link handling, donation banner and independent Digital Rescue Lab attribution.

## Fundraising features — planned, not implemented

- [ ] Artist permission/license register for physical products and authorized remixes.
- [ ] Product costs and accounting rules. User preference: artist receives 50% after agreed material costs.
- [ ] Decide whether/how original collectors participate. No collector percentage has been approved.
- [ ] Storefront, fulfillment, payment allocation and optional remix minting contracts. None deployed.

These are planning records, not legal clearance or finalized agreements.

## Evidence and maintenance

- Main app repository: `bardionson/classic-art-editor`; active local checkout `/home/bardionson/projects/classic-art-editor-800-fix` in WSL Ubuntu.
- Main app: https://www.async.art ; separate revival site: https://asyncart-revival.bardionson.com . A main-app deployment does not establish that a revival-site issue is fixed.
- Supporting app docs: `CHANGELOG-2026-11-07-08.md`, `PRICE-DRIVEN-ART.md`, `FOREVER-SUPPER.md`, `MUSIC-BLUEPRINT-CONTRACT-RECOVERY.md`, `CLASSIC-MUSIC-CONTROLS.md`, `R2-AUDIO.md`, `DYNAMIC-EXPANSION-IMAGES.md`, `ARTIST-PROFILES.md`, `ARCHIVE-SEARCH.md`.
- Recovery workspace: `C:/projects/asyncart/automation-audit/` and related project recovery folders.
- Original automation source is recovered in `C:/projects/asyncart/recovered-source/autonomous-scripts`. Public renderer source is also recovered; completeness/equivalence to the former production renderer remains unverified. Older notes saying no renderer source was found are historical.
- Initial automation audit read only 52 of 2,555 attempted catalog records, finding 41 automated records; 2,503 were deferred after rate limits. This is not the final count of automated artworks.

For each future repair: update its row, link the evidence and deployed commit, and move it to completed only when its acceptance conditions are met. This file is the current checklist; the dated changelog remains historical.

### Bitcoin milestones — November 8

Implemented the original threshold badges, five numeric glyphs and drop behavior for #245. Shared conditional R2 checkpoints retain sparse milestone changes and replay missed hours. Token #247 artist controls remain recorded. All 31 unique image CIDs returned PNG headers through Filebase. 128 targeted tests pass (64 original milestone script comparisons), TypeScript and production build pass. Halvening/dead/flippening have no automatic trigger in the recovered script. Live deployment verification pending.
