export type CombatClass = 'Swordsman' | 'Fighter' | 'Mage' | 'Knight' | 'Archer';

/**
 * Plain domain entity — no drizzle/discord.js imports. It represents the
 * merged shape a service typically needs (user + user_character + users_bag),
 * assembled by a repository, and exposes behaviour instead of letting
 * command handlers poke at raw fields.
 */
export class PlayerAccount {
	constructor(
		public readonly discordId: string,
		public username: string,
		public combatLevel: number,
		public combatExp: number,
		public combatClass: CombatClass,
		public credux: number,
		public beliefShards: number = 0,
	) {}

	canAfford(amount: number): boolean {
		return this.credux >= amount;
	}

	spend(amount: number): void {
		if (!this.canAfford(amount)) {
			throw new Error(`Insufficient credux: has ${this.credux}, needs ${amount}`);
		}
		this.credux -= amount;
	}

	earn(amount: number): void {
		if (!Number.isInteger(amount) || amount <= 0) {
			throw new Error(`earn: amount must be a positive integer, got ${amount}`);
		}
		this.credux += amount;
	}
}
