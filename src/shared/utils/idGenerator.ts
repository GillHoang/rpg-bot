import { GEAR_ID_ERROR_TEXT } from '../ui/text/diagnostics.js';
import { randomBytes } from 'node:crypto';
import type { Executor } from '../../db/client.js';
import { GearIdentityRepository } from '../../modules/progression/infrastructure/GearIdentityRepository.js';

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
	constructor(
		private readonly executor: Executor,
		private readonly identity: Pick<
			GearIdentityRepository,
			'hasWeapon' | 'hasArmor' | 'hasTicket'
		> = new GearIdentityRepository(),
		private readonly createId: () => string = randomId,
	) {}

	async generateUniqueGearId(): Promise<string> {
		for (let attempt = 0; attempt < 10; attempt++) {
			const id = this.createId();
			if (await this.isFree(id)) return id;
		}
		throw new Error(GEAR_ID_ERROR_TEXT.exhausted);
	}

	private async isFree(id: string): Promise<boolean> {
		if (await this.identity.hasWeapon(this.executor, id)) return false;
		if (await this.identity.hasArmor(this.executor, id)) return false;
		return !(await this.identity.hasTicket(this.executor, id));
	}
}
