# Hourly price-driven art restoration

The viewers for ETH Boy `/v2/807` and Right Place & Right Time `/v2/245` now default to an independent hourly restoration. The visible status shows the price hour and provides a switch to recorded on-chain settings. #115 stays hidden and does not use hourly overrides.

## Behavior and boundaries

- The renderer receives overrides only for the known price levers. Local previews take precedence; a clear-preview button returns to automated rendering. Calculated controls are never passed into wallet save forms. No blockchain transactions or private keys are involved.
- Bitcoin's 24 layer transforms update from 25 consecutive completed hourly closes, once per UTC hour. Token #246's milestone controls (96–101) now follow the recovered script: threshold badges, numeric price markers and the drop badge. Token #247's artist styling, including digit opacity, stays recorded.
- ETH Boy starts from token #808's recorded background and butterfly Y, read at one explicit Ethereum block. It applies the recovered price step once for the current completed hour and saves the result. Future steps build from that saved position and clamp to the original bounds. Expression, UTC anniversary object and available current gas clothing opacity are applied too. Fire and random butterfly state/X retain recorded values.
- This is a new hourly interpretation using recovered rules and Coinbase prices. It does not reproduce missing historical years, the original scheduler, or Trevor's separately maintained ETH Boy. Original historical composition equivalence remains unverified.

## Shared state, recovery, cost

`GET /api/artwork-market/render?tokenId=807` uses the existing R2 credentials and server `ALCHEMY_KEY`. It stores one small JSON checkpoint at `archive-automation/v1/ethboy-hourly.json`, containing the anchor block, current positions and latest input window. This is not an image cache or a permanent hourly history. Keep a backup before manually replacing the checkpoint; deleting it causes a new anchor on the next request.

R2 `If-None-Match: *` initializes once; `If-Match: ETag` advances the existing checkpoint atomically. Concurrent requests cannot double-apply movement. Storage read/validation failure never silently resets the anchor. Save failure never publishes an unpersisted new state. The last checkpoint remains visible after data failures, labeled as delayed.

If hours were missed, the next request fetches historical candles and applies each missing hour in order. Recovery is bounded to 168 hours per request, below Coinbase's 300-candle limit after the lookback. Longer outages recover in successive requests; the UI labels old hours while catching up. Missing history stops advancement rather than filling gaps. Historical gas and randomness are not fabricated.

Bitcoin now saves its milestone state at `archive-automation/v1/bitcoin-hourly.json`, with six initial controls anchored from V1 token #246 at one explicit block. Both artworks use conditional R2 writes and replay missed hours. Checks are shared in Next's cache for a minute and normally perform only one new calculation/checkpoint write per hour. Browsers check for a new hour each minute while visible, and immediately on returning to a tab. There is no paid always-on scheduler: the first request after an hour boundary advances the shared state. Existing on-chain rendering is the initial fallback if the new API is unavailable.

## Inspect calculations

`/archive/price-check` and `GET /api/artwork-market` remain the independent calculation inspector, with current tickers, completed-hour inputs, optional current gas and downloadable JSON. This inspector refreshes every five minutes; its `calculation-only` response describes that endpoint, not the connected viewer. Its ETH Boy output is a step, not a saved absolute position.

Coinbase Exchange replaces the unavailable original CryptoCompare feed. Missing, malformed, non-positive, conflicting or stale hourly prices fail closed. The ticker is separate from completed-hour calculations and is not required for viewer updates. Gas estimate equivalence to the original provider remains unverified.

## Validation

128 targeted tests cover the recovered calculations (including original-script golden comparisons), contract/lever mapping, collector-preview separation, position limits, same-hour idempotency, concurrent initialization, missing data, bounded replay and storage failures. TypeScript and production build pass. Deployment/live checks are recorded in the restoration checklist.

## Sources

Rules adapted from `asyncart/autonomous-scripts` commit `931217c50a9aae9437605beabdbbb48cd7f670e4`, with MIT notice in `licenses/autonomous-scripts.txt`:

- `trevjor-alotta/ethboy/update.js`
- `matt-kane/right-place-and-time/update.js`
- https://github.com/asyncart/autonomous-scripts/tree/931217c50a9aae9437605beabdbbb48cd7f670e4
- https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles
- https://developers.cloudflare.com/r2/api/s3/extensions/

## Bitcoin milestone fidelity (November 8)

The restored milestone code is compared against 64 executions of the recovered original script, including every special threshold, crossings, rounded prices, numeric markers and hold/clear behavior. The original metadata maps lever 96 to 18 PNG states and levers 97–101 to five character positions sharing 14 PNG states (31 unique assets including the shared blank).

- The original fixed $19,783 “ATH” threshold has first priority; it is not a new all-time-high detector.
- Special badges and the drop badge change only lever 96, retaining previous number glyphs. A non-rising hour with less than 20% full-window range retains all six previous controls. A rising hour without a special crossing hides the badge and either displays a crossed numeric marker or clears the glyphs.
- Drop uses `(window maximum - minimum) / maximum >= 0.2` when the endpoint is not higher, exactly as the recovered script does.
- “Dead”, “halvening”, and “flippening” exist as graphics, but the recovered script never triggers them automatically. No invented triggers were added.
- Million markers use the original rounding. A label requiring more than the original five character slots fails closed and retains the prior saved state, rather than writing a nonexistent sixth control.
- This starts from recorded milestone controls and advances from restoration onward. It does not invent a history of milestones during the missing years. The first visitor after an hour boundary advances shared state; no always-on cron was added.

Asset check: all 31 original milestone/glyph CIDs returned valid PNG signatures and dimensions through Filebase on November 8. This was a bounded header check; it does not claim permanent pinning or full-file integrity.
