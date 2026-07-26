// Load .env.local/.env the exact same way `next dev`/`next build` do, via
// Next's own env-loading package, rather than vitest inventing its own
// parsing rules for which env files to read and in what precedence.
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());
