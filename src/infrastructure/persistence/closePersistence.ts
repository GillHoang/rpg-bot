import { pool } from '../../db/client.js';

/** Close the shared pool after workers and the bot have stopped. */
export async function closePersistence(): Promise<void> {
	await pool.end();
}
