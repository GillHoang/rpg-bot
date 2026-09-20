/**
 * Post-build guard: `tsc` type-checks but does NOT resolve ESM specifiers
 * (tsconfig `paths` like `@/...` compile fine, then crash at runtime with
 * ERR_MODULE_NOT_FOUND — exactly what slipped in via TestCommand). This
 * script imports every emitted file in dist/ so a broken specifier fails
 * the build immediately. Entry points with import-time side effects are
 * excluded: index.js logs the bot in, scripts/ deploy or migrate, and
 * seed/seed.js writes to the database.
 *
 * Run as part of `pnpm build` (see package.json).
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const distDir = fileURLToPath(new URL('../dist/', import.meta.url));

// Matches vitest.config.ts: modules must import without a real .env present.
for (const [key, value] of Object.entries({
	DISCORD_TOKEN: 'check-dist-token',
	DISCORD_CLIENT_ID: 'check-dist-client-id',
	DATABASE_URL: 'postgres://check:check@localhost:5432/check',
})) {
	process.env[key] ??= value;
}

const EXCLUDED = [/^index\.js$/, /^scripts[/\\]/, /^db[/\\]migrate\.js$/, /^seed[/\\]seed\.js$/];

async function walk(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const absolute = path.join(dir, entry.name);
		if (entry.isDirectory()) files.push(...(await walk(absolute)));
		else if (entry.name.endsWith('.js')) files.push(absolute);
	}
	return files;
}

const all = await walk(distDir);
const files = all.filter((file) => {
	const relative = path.relative(distDir, file);
	return !EXCLUDED.some((pattern) => pattern.test(relative));
});

const failures = [];
for (const file of files) {
	try {
		await import(pathToFileURL(file).href);
	} catch (error) {
		failures.push({ file: path.relative(distDir, file), message: error.message });
	}
}

if (failures.length > 0) {
	console.error('dist/ contains modules that cannot be loaded:');
	for (const failure of failures) console.error(`  ${failure.file}\n    ${failure.message}`);
	process.exit(1);
}
console.log(`dist import check OK: ${files.length} module(s) loaded.`);
