import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { usersBag, userCharacter } from '../db/schema.js';
import { CLASSES } from '../config/classes.js';
import type { CombatClass } from '../domain/entities/PlayerAccount.js';

/**
 * /class change — tiêu 1 Change-Class Token (users_bag.change_class) để đổi
 * class. Giữ nguyên level/exp/gear/deity/preset: stat assembly dựng lại từ
 * computeClassStats(class, level) nên chỉ base class stat thay đổi.
 */
export class ClassChangeService {
	async change(discordId: string, newClass: CombatClass): Promise<string> {
		if (!(newClass in CLASSES)) return 'Class không hợp lệ.';
		return db.transaction(async (tx) => {
			const [character] = await tx
				.select()
				.from(userCharacter)
				.where(eq(userCharacter.discordId, discordId))
				.limit(1)
				.for('update');
			if (!character) return 'Dùng /create trước.';
			const [bag] = await tx
				.select()
				.from(usersBag)
				.where(eq(usersBag.discordId, discordId))
				.limit(1)
				.for('update');
			if (!bag) return 'Dùng /register trước.';
			if (bag.changeClass < 1) return 'Cần 1 Change-Class Token (mua ở /pvp shop).';
			if (character.class === newClass) return 'Bạn đã là class này rồi.';
			await tx.update(userCharacter).set({ class: newClass }).where(eq(userCharacter.discordId, discordId));
			await tx
				.update(usersBag)
				.set({ changeClass: bag.changeClass - 1 })
				.where(eq(usersBag.discordId, discordId));
			return `🔄 Đã đổi class sang **${newClass}**. Level/exp/gear/deity giữ nguyên. (Còn ${bag.changeClass - 1} token)`;
		});
	}
}
