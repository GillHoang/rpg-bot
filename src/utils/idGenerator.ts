import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { userWeapons, userArmors, tickets } from '../db/schema.js';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function randomId(): string {
	const bytes = randomBytes(8);
	let id = '';
	for (let i = 0; i < 8; i++) id += ALPHABET[bytes[i] % 36];
	return id;
}

/**
 * Generates 8-char ids shared across user_weapons / user_armors / tickets
 * (gear ids must be unique across BOTH gear tables so `equip`/`enhance`
 * never resolve an ambiguous id). Ported 1:1 from utils/weaponId.js's
 * generateUniqueGearId.
 *
 * Async for the node-postgres driver: this is always called from inside a
 * `db.transaction(async tx => ...)` callback, so every query here is
 * awaited while still running within the caller's transaction.
 */
export class GearIdGenerator {
	constructor(private readonly executor: Executor) {}

	async generateUniqueGearId(): Promise<string> {
		for (let attempt = 0; attempt < 10; attempt++) {
			const id = randomId();
			if (await this.isFree(id)) return id;
		}
		throw new Error('Failed to generate a unique gear id after 10 attempts');
	}

	private async isFree(id: string): Promise<boolean> {
		const [weaponHit] = await this.executor
			.select()
			.from(userWeapons)
			.where(eq(userWeapons.weaponId, id))
			.limit(1);
		if (weaponHit) return false;
		const [armorHit] = await this.executor.select().from(userArmors).where(eq(userArmors.armorId, id)).limit(1);
		if (armorHit) return false;
		const [ticketHit] = await this.executor.select().from(tickets).where(eq(tickets.ticketId, id)).limit(1);
		return !ticketHit;
	}
}
