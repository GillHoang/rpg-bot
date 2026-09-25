import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import { ProfileQueryRepository } from '../infrastructure/ProfileQueryRepository.js';
import { PlayerAccountRepository } from '../infrastructure/PlayerAccountRepository.js';
import type { UserCharacterRepository } from '../infrastructure/UserCharacterRepository.js';
import { StatAssemblyService } from '../../combat-shared/application/StatAssemblyService.js';
import { expRequiredForLevel } from '../../../shared/config/combatExp.js';

import type { ProfileCardData } from '../../../shared/ui/render/ProfileCardRenderer.js';

export type ProfileSummaryData = Omit<ProfileCardData, 'stats' | 'loadout'>;
export type ProfileSummaryResult =
	{ status: 'not-registered' } | { status: 'no-character' } | { status: 'ok'; data: ProfileSummaryData };

export type ProfileResult =
	{ status: 'not-registered' } | { status: 'no-character' } | { status: 'ok'; data: ProfileCardData };

export interface ProfileDependencies {
	persistence: PersistenceContext;
	queries?: Pick<ProfileQueryRepository, 'findCharacter' | 'findTitleDisplay' | 'findLoadout' | 'findPreset'>;
}

export class ProfileService {
	private readonly persistence: PersistenceContext;
	private readonly accounts: Pick<PlayerAccountRepository, 'findById'>;
	private readonly statAssembly: Pick<StatAssemblyService, 'assemble'>;
	private readonly queries: NonNullable<ProfileDependencies['queries']>;
	constructor(
		accounts: Pick<PlayerAccountRepository, 'findById'> | undefined = undefined,
		_characters: Pick<UserCharacterRepository, 'hasCharacter'> | undefined = undefined,
		statAssembly: Pick<StatAssemblyService, 'assemble'> | undefined = undefined,
		options: ProfileDependencies,
	) {
		this.persistence = requirePersistence(options, 'ProfileService');
		this.accounts = accounts ?? new PlayerAccountRepository(this.persistence.executor);
		this.statAssembly =
			statAssembly ?? new StatAssemblyService(undefined, undefined, undefined, { persistence: this.persistence });
		this.queries = options.queries ?? new ProfileQueryRepository();
	}

	async get(discordId: string, mode: 'summary'): Promise<ProfileSummaryResult>;
	async get(discordId: string, mode?: 'detail'): Promise<ProfileResult>;
	async get(discordId: string, mode: 'summary' | 'detail' = 'detail'): Promise<ProfileSummaryResult | ProfileResult> {
		// All reads ride one transaction so the card can never mix a fresh
		// class with a stale balance committed mid-read (display-only, but
		// cheap to keep consistent).
		return this.persistence.unitOfWork.run(async (tx) => {
			const account = await this.accounts.findById(discordId, tx);
			if (!account) return { status: 'not-registered' };
			const [character] = await this.queries.findCharacter(tx, discordId);
			if (!character) return { status: 'no-character' };

			const summary: ProfileSummaryData = {
				username: account.username,
				combatClass: account.combatClass,
				level: account.combatLevel,
				exp: account.combatExp,
				expToNext: expRequiredForLevel(account.combatLevel),
				credux: account.credux,
				beliefShards: account.beliefShards,
				believerLevel: character.believerLevel,
				believerExp: character.believerExp,
				pvpRating: character.pvpRating,
			};
			if (mode === 'summary') return { status: 'ok', data: summary };
			const [preset] = await this.queries.findPreset(tx, discordId, character.activePresetSlot);
			const assembled = await this.statAssembly.assemble(
				discordId,
				account.combatClass,
				account.combatLevel,
				tx,
				preset ?? null,
			);
			const loadout = await this.queries.findLoadout(tx, discordId, character.activePresetSlot, preset ?? null);
			let title: string | null = null;
			if (character?.equippedTitleId) {
				const [row] = await this.queries.findTitleDisplay(tx, character.equippedTitleId);
				title = row?.display ?? null;
			}

			return { status: 'ok', data: { ...summary, stats: assembled.stats, loadout, title } };
		});
	}
}
