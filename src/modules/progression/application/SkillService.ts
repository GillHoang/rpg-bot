import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import { AppError, err, ok, type Result } from '../../../shared/kernel/Result.js';
import { LoadoutRepository } from '../infrastructure/LoadoutRepository.js';
import {
	BATTLE_STANCES,
	MAX_EQUIPPED_SKILLS,
	SKILL_DEFS,
	skillsForClass,
	type BattleStance,
} from '../../../shared/config/skills.js';
import {
	SKILL_EQUIPPED,
	SKILL_INVALID_ORDER,
	SKILL_INVALID_SLOT,
	SKILL_LIST_FOOTER,
	SKILL_LIST_HEADER,
	SKILL_LIST_LINE,
	SKILL_NOT_REGISTERED,
	SKILL_ORDER_SET,
	SKILL_UNEQUIPPED,
	SKILL_UNKNOWN,
	SKILL_WRONG_CLASS,
} from '../../../shared/ui/text/skills.js';
import { SKILL_NAMES, SKILL_DESCS } from '../../../shared/ui/text/skills.js';

export interface SkillDependencies {
	persistence: PersistenceContext;
	queries?: Pick<LoadoutRepository, 'lockCharacter' | 'updateCharacter'>;
}

/**
 * Phase 2 skill loadout — /skill list|equip|order. Skills are validated
 * against the player's class at equip time; assembly filters defensively.
 * Wording lives in shared/ui/text/skills.ts.
 */
export class SkillService {
	private readonly persistence: PersistenceContext;
	private readonly queries: Pick<LoadoutRepository, 'lockCharacter' | 'updateCharacter'>;

	constructor(options: SkillDependencies) {
		this.persistence = requirePersistence(options, 'SkillService');
		this.queries = options.queries ?? new LoadoutRepository();
	}

	async list(discordId: string): Promise<Result<string, AppError>> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const [character] = await this.queries.lockCharacter(tx, discordId);
			if (!character) return err(new AppError('SKILL_NOT_REGISTERED', SKILL_NOT_REGISTERED));
			const equipped = [character.skillSlot1, character.skillSlot2];
			const lines = skillsForClass(character.class).map((def) => {
				const slot = equipped.indexOf(def.key) + 1;
				const mark = slot > 0 ? ` (ô ${slot})` : '';
				return SKILL_LIST_LINE(
					SKILL_NAMES[def.key] ?? def.key,
					def.kind,
					def.cost,
					def.cooldown,
					(SKILL_DESCS[def.key] ?? '') + mark,
				);
			});
			return ok([SKILL_LIST_HEADER, ...lines, SKILL_LIST_FOOTER].join('\n'));
		});
	}

	/** Equip a skill into slot 1..MAX_EQUIPPED_SKILLS; key null/empty unequips. */
	async equip(discordId: string, slot: number, key: string | null): Promise<Result<string, AppError>> {
		if (!Number.isInteger(slot) || slot < 1 || slot > MAX_EQUIPPED_SKILLS)
			return err(new AppError('SKILL_INVALID_SLOT', SKILL_INVALID_SLOT));
		return this.persistence.unitOfWork.run(async (tx) => {
			const [character] = await this.queries.lockCharacter(tx, discordId);
			if (!character) return err(new AppError('SKILL_NOT_REGISTERED', SKILL_NOT_REGISTERED));
			if (key == null || key === '') {
				await this.queries.updateCharacter(tx, discordId, { [slot === 1 ? 'skillSlot1' : 'skillSlot2']: null });
				return ok(SKILL_UNEQUIPPED(slot));
			}
			const def = SKILL_DEFS[key];
			if (!def) return err(new AppError('SKILL_UNKNOWN', SKILL_UNKNOWN));
			if (def.combatClass !== character.class)
				return err(new AppError('SKILL_WRONG_CLASS', SKILL_WRONG_CLASS));
			const other = slot === 1 ? character.skillSlot2 : character.skillSlot1;
			const patch: { skillSlot1?: string | null; skillSlot2?: string | null } =
				slot === 1 ? { skillSlot1: key } : { skillSlot2: key };
			// Moving a skill clears its old slot — one skill, one slot.
			if (other === key) {
				if (slot === 1) patch.skillSlot2 = null;
				else patch.skillSlot1 = null;
			}
			await this.queries.updateCharacter(tx, discordId, patch);
			return ok(SKILL_EQUIPPED(SKILL_NAMES[key] ?? key, slot));
		});
	}

	async setOrder(discordId: string, order: string): Promise<Result<string, AppError>> {
		if (!(BATTLE_STANCES as readonly string[]).includes(order))
			return err(new AppError('SKILL_INVALID_ORDER', SKILL_INVALID_ORDER));
		return this.persistence.unitOfWork.run(async (tx) => {
			const [character] = await this.queries.lockCharacter(tx, discordId);
			if (!character) return err(new AppError('SKILL_NOT_REGISTERED', SKILL_NOT_REGISTERED));
			await this.queries.updateCharacter(tx, discordId, { battleOrder: order as BattleStance });
			return ok(SKILL_ORDER_SET(order));
		});
	}
}
