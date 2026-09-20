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
		env: {
			DISCORD_TOKEN: 'test-token',
			DISCORD_CLIENT_ID: 'test-client-id',
			DATABASE_URL: 'postgres://test:test@localhost:5432/test',
			LOG_LEVEL: 'fatal',
		},
	},
});
