import { SeasonService } from '../services/SeasonService.js';
import { pool } from '../db/client.js';
import { logger } from '../utils/logger.js';

try {
	const expectedId = Number(process.argv[2]);
	if (!Number.isSafeInteger(expectedId) || expectedId < 1)
		throw new Error('Usage: pnpm season:rollover <expected-active-season-id>');
	const result = await new SeasonService().rollover(expectedId);
	logger.info({ result }, 'season-rollover');
	if (result.status !== 'ok') process.exitCode = 1;
} finally {
	await pool.end();
}
