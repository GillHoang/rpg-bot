import { LOG_EVENT_TEXT, SEASON_CLI_TEXT } from '../text/diagnostics.js';

import { SeasonService } from '../services/SeasonService.js';
import { pool } from '../db/client.js';
import { logger } from '../utils/logger.js';

try {
	const expectedId = Number(process.argv[2]);
	if (!Number.isSafeInteger(expectedId) || expectedId < 1) throw new Error(SEASON_CLI_TEXT.usage);
	const result = await new SeasonService().rollover(expectedId);
	logger.info({ result }, LOG_EVENT_TEXT.seasonRollover);
	if (result.status !== 'ok') process.exitCode = 1;
} finally {
	await pool.end();
}
