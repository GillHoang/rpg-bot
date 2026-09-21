import type { PersistenceContext } from '../application/ports/PersistenceContext.js';
import { defaultPersistence } from '../infrastructure/persistence/defaultPersistence.js';
import { ProfileQueryRepository } from '../repositories/ProfileQueryRepository.js';
import { PlayerAccountRepository } from '../repositories/PlayerAccountRepository.js';
import { UserCharacterRepository } from '../repositories/UserCharacterRepository.js';
import { StatAssemblyService } from './StatAssemblyService.js';
import { expRequiredForLevel } from '../config/combatExp.js';

import type { ProfileCardData } from '../render/ProfileCardRenderer.js';

export type ProfileResult =
	{ status: 'not-registered' } | { status: 'no-character' } | { status: 'ok'; data: ProfileCardData };

export interface ProfileDependencies {
	persistence?: PersistenceContext;
	queries?: Pick<ProfileQueryRepository, 'findCharacter' | 'findTitleDisplay'>;
}

export class ProfileService {
	private readonly persistence: PersistenceContext;
	private readonly accounts: Pick<PlayerAccountRepository, 'findById'>;
	private readonly characters: Pick<UserCharacterRepository, 'hasCharacter'>;
	private readonly statAssembly: Pick<StatAssemblyService, 'assemble'>;
	private readonly queries: NonNullable<ProfileDependencies['queries']>;
	constructor(
		accounts: Pick<PlayerAccountRepository, 'findById'> | undefined = undefined,
		characters: Pick<UserCharacterRepository, 'hasCharacter'> | undefined = undefined,
		statAssembly: Pick<StatAssemblyService, 'assemble'> | undefined = undefined,
		options: ProfileDependencies = {},
	) {
		this.persistence = options.persistence ?? defaultPersistence;
		this.accounts = accounts ?? new PlayerAccountRepository(this.persistence.executor);
		this.characters = characters ?? new UserCharacterRepository();
		this.statAssembly =
			statAssembly ?? new StatAssemblyService(undefined, undefined, undefined, { persistence: this.persistence });
		this.queries = options.queries ?? new ProfileQueryRepository();
	}

	async get(discordId: string): Promise<ProfileResult> {
		const account = await this.accounts.findById(discordId);
		if (!account) return { status: 'not-registered' };
		if (!(await this.characters.hasCharacter(this.persistence.executor, discordId)))
			return { status: 'no-character' };

		const assembled = await this.statAssembly.assemble(
			discordId,
			account.combatClass,
			account.combatLevel,
			this.persistence.executor,
		);
		const [character] = await this.queries.findCharacter(this.persistence.executor, discordId);
		let title: string | null = null;
		if (character?.equippedTitleId) {
			const [row] = await this.queries.findTitleDisplay(this.persistence.executor, character.equippedTitleId);
			title = row?.display ?? null;
		}

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
				title,
				believerLevel: character?.believerLevel,
				believerExp: character?.believerExp,
				pvpRating: character?.pvpRating,
			},
		};
	}
}
