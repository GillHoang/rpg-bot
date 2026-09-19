import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { usersBag, userCharacter } from '../db/schema.js';
import { CLASSES } from '../config/classes.js';
import {
	CLASS_CHANGED,
	CLASS_INVALID,
	CLASS_NO_CHARACTER,
	CLASS_NO_REGISTER,
	CLASS_NO_TOKEN,
	CLASS_SAME,
} from '../text/class.js';
import type { CombatClass } from '../domain/entities/PlayerAccount.js';

/**
 * /class change — tiêu 1 Change-Class Token (users_bag.change_class) để đổi
 * class. Giữ nguyên level/exp/gear/deity/preset: stat assembly dựng lại từ
 * computeClassStats(class, level) nên chỉ base class stat thay đổi.
 * Wording nằm ở src/text/class.ts.
 */
export class ClassChangeService {
	async change(discordId: string, newClass: CombatClass): Promise<string> {
		if (!(newClass in CLASSES)) return CLASS_INVALID;
		return db.transaction(async (tx) => {
			const [character] = await tx
				.select()
				.from(userCharacter)
				.where(eq(userCharacter.discordId, discordId))
				.limit(1)
				.for('update');
			if (!character) return CLASS_NO_CHARACTER;
			const [bag] = await tx
				.select()
				.from(usersBag)
				.where(eq(usersBag.discordId, discordId))
				.limit(1)
				.for('update');
			if (!bag) return CLASS_NO_REGISTER;
			if (bag.changeClass < 1) return CLASS_NO_TOKEN;
			if (character.class === newClass) return CLASS_SAME;
			await tx.update(userCharacter).set({ class: newClass }).where(eq(userCharacter.discordId, discordId));
			await tx
				.update(usersBag)
				.set({ changeClass: bag.changeClass - 1 })
				.where(eq(usersBag.discordId, discordId));
			return CLASS_CHANGED(newClass, bag.changeClass - 1);
		});
	}
}
