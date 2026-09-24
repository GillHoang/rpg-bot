import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * `src/config/env.ts` zod-validates DISCORD_TOKEN / DISCORD_CLIENT_ID /
 * DATABASE_URL at import time (logger → env is reachable from the domain
 * event wiring). Tests must not depend on a real `.env`, so dummies are
 * injected for the whole suite — production keeps its fail-fast behaviour.
 */
export default defineConfig({
	// Mirror tsconfig's "@/*" paths so vitest can resolve alias imports (tsc
	// alone reads tsconfig paths; vitest needs its own resolve.alias).
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	test: {
		// PGlite suites each boot PostgreSQL in WASM (some boot two instances).
		// Bound CPU/memory contention so setup and queries stay within their timeouts.
		maxWorkers: 2,
		// Migration + seed hooks boot PGlite in WASM (some suites boot two instances
		// in one beforeAll); under background CPU load (games/other apps on the
		// machine) even 60s starves — 120s still bounds real hangs.
		hookTimeout: 120_000,
		// Individual tests normally finish in <5s; on a loaded machine PGlite
		// queries starve past 5s. 30s absorbs background load without hiding hangs.
		testTimeout: 30_000,
		env: {
			DISCORD_TOKEN: 'test-token',
			DISCORD_CLIENT_ID: 'test-client-id',
			DATABASE_URL: 'postgres://test:test@localhost:5432/test',
			LOG_LEVEL: 'fatal',
			ERROR_WEBHOOK_URL: '',
			OWNER_DISCORD_IDS: '123456789012345678',
			DEPLOY_GUILD_ID: '1234567890',
		},
	},
});
