import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import { AppError, err, ok, type Result } from '../../../shared/kernel/Result.js';
import { LoadoutRepository } from '../infrastructure/LoadoutRepository.js';
import { BRANCH_MIN_LEVEL, CLASS_BRANCHES, branchesForClass } from '../../../shared/config/branches.js';
import {
	BRANCH_DESCS,
	BRANCH_LIST_HEADER,
	BRANCH_LIST_LINE,
	BRANCH_LOW_LEVEL,
	BRANCH_NAMES,
	BRANCH_NOT_REGISTERED,
	BRANCH_SET,
	BRANCH_UNKNOWN,
	BRANCH_WRONG_CLASS,
} from '../../../shared/ui/text/branch.js';

export interface BranchDependencies {
	persistence: PersistenceContext;
	queries?: Pick<LoadoutRepository, 'lockCharacter' | 'updateCharacter'>;
}

/**
 * Phase 3 class branch — /branch list|set. Lv.40+, đổi tự do, tilt áp trong
 * StatAssembly (branch lạ class sau đổi class không có tác dụng).
 */
export class BranchService {
	private readonly persistence: PersistenceContext;
	private readonly queries: Pick<LoadoutRepository, 'lockCharacter' | 'updateCharacter'>;

	constructor(options: BranchDependencies) {
		this.persistence = requirePersistence(options, 'BranchService');
		this.queries = options.queries ?? new LoadoutRepository();
	}

	async list(discordId: string): Promise<Result<string, AppError>> {
		return this.persistence.unitOfWork.run(async (tx) => {
			const [character] = await this.queries.lockCharacter(tx, discordId);
			if (!character) return err(new AppError('BRANCH_NOT_REGISTERED', BRANCH_NOT_REGISTERED));
			const lines = branchesForClass(character.class).map((b) =>
				BRANCH_LIST_LINE(BRANCH_NAMES[b.key] ?? b.key, BRANCH_DESCS[b.key] ?? '', character.classBranch === b.key),
			);
			return ok([BRANCH_LIST_HEADER, ...lines].join('\n'));
		});
	}

	async set(discordId: string, key: string): Promise<Result<string, AppError>> {
		const def = CLASS_BRANCHES[key];
		if (!def) return err(new AppError('BRANCH_UNKNOWN', BRANCH_UNKNOWN));
		return this.persistence.unitOfWork.run(async (tx) => {
			const [character] = await this.queries.lockCharacter(tx, discordId);
			if (!character) return err(new AppError('BRANCH_NOT_REGISTERED', BRANCH_NOT_REGISTERED));
			if (def.combatClass !== character.class)
				return err(new AppError('BRANCH_WRONG_CLASS', BRANCH_WRONG_CLASS));
			if (character.combatLevel < BRANCH_MIN_LEVEL)
				return err(new AppError('BRANCH_LOW_LEVEL', BRANCH_LOW_LEVEL(BRANCH_MIN_LEVEL)));
			await this.queries.updateCharacter(tx, discordId, { classBranch: key });
			return ok(BRANCH_SET(BRANCH_NAMES[key] ?? key));
		});
	}
}
