import { PlayerAccountRepository } from '../repositories/PlayerAccountRepository.js';
import { UserCharacterRepository } from '../repositories/UserCharacterRepository.js';
import { StatAssemblyService } from './StatAssemblyService.js';
import { expRequiredForLevel } from '../config/combatExp.js';
import { db } from '../db/client.js';
import type { ProfileCardData } from '../render/ProfileCardRenderer.js';

export type ProfileResult =
	{ status: 'not-registered' } | { status: 'no-character' } | { status: 'ok'; data: ProfileCardData };

export class ProfileService {
	constructor(
		private readonly accounts = new PlayerAccountRepository(),
		private readonly characters = new UserCharacterRepository(),
		private readonly statAssembly = new StatAssemblyService(),
	) {}

	async get(discordId: string): Promise<ProfileResult> {
		const account = await this.accounts.findById(discordId);
		if (!account) return { status: 'not-registered' };
		if (!(await this.characters.hasCharacter(db, discordId))) return { status: 'no-character' };

		const assembled = await this.statAssembly.assemble(discordId, account.combatClass, account.combatLevel);

		return {
			status: 'ok',
			data: {
				username: account.username,
				combatClass: account.combatClass,
				level: account.combatLevel,
				exp: account.combatExp,
				expToNext: expRequiredForLevel(account.combatLevel),
				stats: assembled.stats,
				credux: account.credux,
				beliefShards: account.beliefShards,
			},
		};
	}
}
