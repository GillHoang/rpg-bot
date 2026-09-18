import { eq } from 'drizzle-orm';
import type { Executor } from '../db/client.js';
import { userCharacter } from '../db/schema.js';
import type { CombatClass } from '../domain/entities/PlayerAccount.js';

export class UserCharacterRepository {
	hasCharacter(executor: Executor, discordId: string): boolean {
		return !!executor.select().from(userCharacter).where(eq(userCharacter.discordId, discordId)).get();
	}

	insert(executor: Executor, discordId: string, combatClass: CombatClass): void {
		executor.insert(userCharacter).values({ discordId, class: combatClass }).run();
	}
}
