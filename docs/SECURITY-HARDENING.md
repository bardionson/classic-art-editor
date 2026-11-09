# Wallet/API security hardening — 8 November 2026

Implemented in the WSL checkout `/home/bardionson/projects/classic-art-editor-800-fix`. Not deployed: shared Redis configuration must be verified before publishing. Existing work in README.md and FOREVER-SUPPER.md is unrelated and preserved.

## Changes

- The public Alchemy proxy accepts only chain ID, block number, and the app's ownerOf, tokenURI and getControlToken reads against the configured classic contracts. It rejects transaction relaying, arbitrary contracts, state overrides and unsupported methods before contacting Alchemy.
- Requests are limited to 16 KiB and batches to 20 calls. Request-body and upstream deadlines bound waiting time. Provider error details and credential-bearing URLs are not echoed or logged.
- Shared Redis budgets cover RPC, NFT ownership lookup and ENS lookup across Vercel instances. The Lua operation checks and increments all budgets atomically. Default allowances are 600 weighted reads per IP per minute, 6,000 globally per minute and 200,000 globally per day. These are application units, not Alchemy billing/CU units or a guaranteed dollar cap. Ownership lookup reserves 20 units for up to 20 pages; ENS reserves four.
- Vercel's protected client-IP header is hashed for the per-IP bucket. Production and preview fail closed with HTTP 503 when Redis is missing/unavailable, and HTTP 429 when a budget is exhausted. These shared limits bound upstream consumption but do not prevent denial of service by someone exhausting the shared allowance.
- The normal ownership checks and wallet-approved useControlToken writes remain in place. Gas-paying collector changes use the wallet transport, not this public read proxy. No transfers or spending approvals were added. Mirror security behavior was not changed.

## Framework and dependencies

Updated Next.js 14.2.33 to 15.5.29 and migrated page/route parameters to its asynchronous API. Kept React 18 and wagmi 2 for RainbowKit compatibility. Set Node 22.x in package.json for Vercel. Replaced obsolete next-bundle-analyzer with the official @next/bundle-analyzer. Updated RainbowKit, viem, WalletConnect, ws, PostCSS, Vitest and compatible transitive dependencies.

WalletConnect's ethereum-provider is pinned to 2.26.0 through an override. Coinbase CDP SDK is pinned to the previously used 1.38.6: the newly resolved 1.61.0 introduced missing optional @x402 imports into the Base Account bundle and failed the production build. Other patched compatible transitive packages remain updated. Revisit this pin with upstream wallet support.

Production npm audit changed from 49 flagged package entries (1 critical, 27 high, 19 moderate, 2 low) to 26 (0 critical, 13 high, 11 moderate, 2 low). Counts include inherited dependency findings, not distinct exploitable vulnerabilities.

**Unresolved:** all remaining high entries trace to Zod advisory GHSA-mrhx-c7xc-m3w5. Reown and Coinbase SDKs require Zod 3, whereas the published fix is Zod 4.6.6. Forcing Zod 4 globally is not a compatible patch. This remains open pending upstream-compatible SDK updates or separately tested connector replacement. No claim is made that every installed advisory is reachable in this app. Lower-severity leaf advisories also remain in stream-json, uuid and deepmerge.

## Required Vercel setup before deployment

1. Connect an Upstash Redis database to the Vercel project and enable its server-only KV_REST_API_URL and KV_REST_API_TOKEN for the deployment environments. This complete pair takes priority. UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are supported when a complete KV pair is absent. Do not use NEXT_PUBLIC names for secrets. Use separate preview storage if preview should not share production's daily allowance.
2. Keep ALCHEMY_KEY server-only. Node 22 is selected through package.json engines; use npm ci and npm run build.
3. Verify Redis connectivity and EVAL permission in a preview deployment, then verify allowed artwork reads succeed. Missing Redis intentionally returns 503; do not publish this configuration to production without that check.
4. Optional tuning: ALCHEMY_IP_BUDGET_PER_MINUTE, ALCHEMY_GLOBAL_BUDGET_PER_MINUTE and ALCHEMY_GLOBAL_BUDGET_PER_DAY. Positive integer values only. Review real artwork traffic and Alchemy usage when tuning.
5. Verify wallet connection, ownership display, and the layer Update on Chain flow in preview. A real gas-paying transaction was not submitted during this patch. Any test transaction requires the user's wallet confirmation.

## Validation

- Clean npm ci succeeded using Node 22.23.0 and npm 10.9.8, without legacy-peer-deps.
- Next.js production build passed. One non-fatal viem/ox dynamic-import warning remains.
- TypeScript check passed.
- Full tests: 399 passed, 8 skipped; the skipped tests include live external-service checks. New security tests cover permitted/forbidden RPC calls, bounded bodies/batches, sanitized errors, shared budget arguments, protected IP identity and fail-closed behavior.
- Corrected an existing inventory test to explicitly account for the intentionally hidden #115 record while retaining its original raw metadata.
- Local production HTTP checks passed for the home page, wallet, #1605, artists/XCOPY, Blueprint project and search pages. Unsupported RPC calls returned 400; missing production Redis returned 503 without exposing credentials. The wallet page hydrated and its chooser opened without console errors. No wallet was connected or transaction signed.
- Real Upstash execution and live Vercel deployment verification remain outstanding.

References: [Next 15 migration](https://nextjs.org/docs/app/guides/upgrading/version-15), [Vercel Node runtimes](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Vercel request headers](https://vercel.com/docs/headers/request-headers), [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

## Preview Redis diagnostics — 9 November 2026

503 responses now include a fixed READ_BUDGET_* code distinguishing missing configuration, timeout, authentication/permissions, invalid response and other connection/service failures. Logs contain only that category, never upstream messages or credentials. Saving Vercel environment variables requires a new deployment; enable the variables for Preview before building the preview branch. Production remains gated on successful live Redis and artwork reads.

Follow-up: select complete Upstash or KV URL/token pairs instead of independently mixing aliases. Validate HTTPS REST endpoint and token formatting before invoking the SDK. Diagnostics identify which variable pair was selected (names only) and categorize DNS/TLS/connectivity, quota, database, script, counter-type and response-format failures. The actual deployment failure remains unconfirmed; the user reports Redis Available. Validation: 23 targeted tests passed, including real SDK serialization/response handling with HTTP mocked, and TypeScript passed. No live Redis success claimed.

Confirmed preview diagnosis: READ_BUDGET_NETWORK_DNS with configuration=upstash. The selected legacy Upstash hostname failed DNS resolution even though the user had connected an Available Vercel KV database. Prioritize the complete KV integration pair; do not switch databases following request failure (that would split budget accounting). Added dual-configuration regression coverage, including the installed SDK transport. Live KV success still requires verification in the new preview.
