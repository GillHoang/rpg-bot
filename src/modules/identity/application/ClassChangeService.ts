import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import { AccountLifecycleRepository } from '../infrastructure/AccountLifecycleRepository.js';

import { CLASSES } from '../../../shared/config/classes.js';
import {
	CLASS_CHANGED,
	CLASS_INVALID,
	CLASS_NO_CHARACTER,
	CLASS_NO_REGISTER,
	CLASS_NO_TOKEN,
	CLASS_SAME,
} from '../../../shared/ui/text/class.js';
import type { CombatClass } from '../domain/PlayerAccount.js';
import { AppError, err, ok, type Result } from '../../../shared/kernel/Result.js';

export interface ClassChangeDependencies {
	persistence: PersistenceContext;
	queries?: Pick<
		AccountLifecycleRepository,
		'lockCharacter' | 'lockBagForClassChange' | 'updateClass' | 'updateClassTokens'
	>;
}

/**
 * /class change — tiêu 1 Change-Class Token (users_bag.change_class) để đổi
 * class. Giữ nguyên level/exp/gear/deity/preset: stat assembly dựng lại từ
 * computeClassStats(class, level) nên chỉ base class stat thay đổi.
 * Wording nằm ở src/shared/ui/text/class.ts.
 */

export class ClassChangeService {
	private readonly persistence: PersistenceContext;
	private readonly queries: NonNullable<ClassChangeDependencies['queries']>;
	constructor(options: ClassChangeDependencies) {
		this.persistence = requirePersistence(options, 'ClassChangeService');
		this.queries = options.queries ?? new AccountLifecycleRepository();
	}
	async change(discordId: string, newClass: CombatClass): Promise<Result<string, AppError>> {
		if (!(newClass in CLASSES)) return err(new AppError('CLASS_INVALID', CLASS_INVALID));
		return this.persistence.unitOfWork.run(async (tx): Promise<Result<string, AppError>> => {
			const [bag] = await this.queries.lockBagForClassChange(tx, discordId);
			const [character] = await this.queries.lockCharacter(tx, discordId);
			if (!character) return err(new AppError('CLASS_NO_CHARACTER', CLASS_NO_CHARACTER));
			if (!bag) return err(new AppError('CLASS_NO_REGISTER', CLASS_NO_REGISTER));
			// Same-class check first: re-selecting the current class is a
			// no-op request, not a missing-token problem.
			if (character.class === newClass) return err(new AppError('CLASS_SAME_CLASS', CLASS_SAME));
			if (bag.changeClass < 1) return err(new AppError('CLASS_NO_TOKEN', CLASS_NO_TOKEN));
			await this.queries.updateClass(tx, discordId, { class: newClass });
			await this.queries.updateClassTokens(tx, discordId, { changeClass: bag.changeClass - 1 });
			return ok(CLASS_CHANGED(newClass, bag.changeClass - 1));
		});
	}
}
