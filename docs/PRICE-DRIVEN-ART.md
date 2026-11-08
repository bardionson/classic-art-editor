# Independent price checker

Entry: `/archive/price-check`; API: `GET /api/artwork-market`.

This is a calculation-only restoration tool, not a restart of on-chain automation or a fully restored composition. It submits no transactions and stores no private keys. It requires no new environment variables. The existing server ALCHEMY_KEY optionally supplies a current eth_gasPrice estimate; unavailable gas does not prevent price checks.

Coinbase Exchange supplies ETH-USD and BTC-USD last trades plus 25 consecutive completed hourly closes. This replaces CryptoCompare, which returned HTTP 401 in recovery checks. Current quotes are separate from the exact 24-hour close-to-close window. Missing, non-positive, malformed, conflicting or stale prices fail closed. Completed-hour timestamps and all calculation inputs are included in downloadable JSON.

Next data cache shares validated readings for up to five minutes. The client checks every five minutes while visible and again when returning to the page. No always-on scheduler, database, persistent R2 history or image imports are added. Previous readings are marked after errors/expiry. Daily recovery needs a separately designed replay/checkpoint process.

Rules adapted from asyncart/autonomous-scripts commit 931217c50a9aae9437605beabdbbb48cd7f670e4, MIT notice in licenses/autonomous-scripts.txt:
- trevjor-alotta/ethboy/update.js: background and butterfly deltas, expression, UTC special dates, gas clothing opacity. Positions require prior state and clamping. Random butterfly values and missing daily history are deliberately not invented.
- matt-kane/right-place-and-time/update.js: 24 scale/rotation/X/Y transformations; milestone graphics and artist styling remain out of scope. Exactly 25 completed closes replace the ambiguous original limit=25 provider response. Zero range produces rotation 0 instead of NaN.

Gas estimate equivalence to the original provider and historical composition equivalence remain unverified. Neither the source switch nor this preview should be presented as canonical on-chain state.

Sources:
- https://github.com/asyncart/autonomous-scripts/tree/931217c50a9aae9437605beabdbbb48cd7f670e4
- https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles
- https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-ticker
