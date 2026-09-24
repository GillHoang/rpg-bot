import { eq } from 'drizzle-orm';
import type { Executor } from '../../../db/client.js';
import { userWeapons, userArmors, tickets } from '../../../db/schema.js';

/** Checks each namespace using the executor supplied by the gear creation workflow. */
export class GearIdentityRepository {
	async hasWeapon(executor: Executor, id: string): Promise<boolean> {
		const [row] = await executor.select().from(userWeapons).where(eq(userWeapons.weaponId, id)).limit(1);
		return row !== undefined;
	}

	async hasArmor(executor: Executor, id: string): Promise<boolean> {
		const [row] = await executor.select().from(userArmors).where(eq(userArmors.armorId, id)).limit(1);
		return row !== undefined;
	}

	async hasTicket(executor: Executor, id: string): Promise<boolean> {
		const [row] = await executor.select().from(tickets).where(eq(tickets.ticketId, id)).limit(1);
		return row !== undefined;
	}
}
