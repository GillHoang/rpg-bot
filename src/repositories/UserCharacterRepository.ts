import { eq } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { userCharacter } from '../db/schema.js';
import type { CombatClass } from '../domain/entities/PlayerAccount.js';

export class UserCharacterRepository {
	async hasCharacter(executor: Executor, discordId: string): Promise<boolean> {
		const [row] = await executor.select().from(userCharacter).where(eq(userCharacter.discordId, discordId)).limit(1);
		return !!row;
	}

	async insert(executor: Executor, discordId: string, combatClass: CombatClass): Promise<void> {
		await executor.insert(userCharacter).values({ discordId, class: combatClass });
	}
}
