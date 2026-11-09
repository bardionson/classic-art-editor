# Programmable art review checklist

Audit: 2026-11-09T01:17:01.786612+00:00

2126 automatic works listed; 2115 metadata timers. 2552/2561 master metadata files read.

115,570 state-selection cases; 50,616 hourly live-refresh checks. 2114 timer checks passed; 1 needs date review; 0 timer failures.

Open the searchable inventory: https://www.async.art/about/inventory

- Every classic/music Master record in the current catalog was attempted; this is not a complete on-chain census.
- Timer simulations exercise state selection, leap/non-leap calendar dates, UTC offsets, scheduled dates and hourly open-page refresh.
- Media checks read image signatures only. They do not prove complete decoding or visual fidelity.
- Only documented automatic time, calendar, price, random or external-data behavior is listed. Ordinary collector controls, music playback, collector-triggered interactions and Forever Supper arrangements are outside this inventory.
- Nine unread metadata records and the unconfirmed MLIBTY source mapping remain discovery gaps; they are not counted as automatic works. Ordinary Blueprint and Music Blueprint editions are fixed after minting and excluded.

| Work | Artist | Mechanics | Validation |
| --- | --- | --- | --- |

Full data and review links: `public/archive/programmable-audit.json`.

Repeat timer validation with PROGRAMMABLE_INVENTORY pointing to the census JSON and PROGRAMMABLE_RESULTS to an output file: `npm test -- scripts/validate-programmable.test.ts`. Metadata is preserved in the local recovery workspace, not copied into the deployed app.

Scope correction: 2,126 automatic works, including all 2,115 metadata timers. Only documented automatic time/calendar, price, seeded daily or external-data triggers qualify. Collector-only works, collector-triggered interaction scripts, music playback and Forever Supper arrangements are excluded. Nine metadata gaps and the unconfirmed MLIBTY script association are not counted as automatic works. Eight calendar/anniversary entries include six metadata timers and two external scheduled works.

Media: 15,197/15,197 timer image signatures verified after retries, not full image decoding. Timer repairs remain #567 opacity and #571 timezone. #786 needs anniversary-date review; #3207 identity remains unverified.
