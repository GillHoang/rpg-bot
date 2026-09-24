import { and, eq, inArray } from 'drizzle-orm';
import { PlayerLoadoutQueryRepository } from '../../progression/infrastructure/PlayerLoadoutQueryRepository.js';
import type { Executor } from '../../../db/client.js';
import {
	titleCatalog,
	userPresets,
	userWeapons,
	weaponRoster,
	userArmors,
	armorRoster,
	userDeities,
	deityRoster,
} from '../../../db/schema.js';

/** Named persistence operations; callers own transactions and reward policy. */
export class ProfileQueryRepository extends PlayerLoadoutQueryRepository {
	async findLoadout(
		executor: Executor,
		discordId: string,
		slot: number,
		suppliedPreset?: typeof userPresets.$inferSelect | null,
	) {
		const preset =
			suppliedPreset !== undefined
				? suppliedPreset
				: (
						await executor
							.select()
							.from(userPresets)
							.where(and(eq(userPresets.discordId, discordId), eq(userPresets.slot, slot)))
							.limit(1)
					)[0];
		if (!preset) return { weapon: null, armor: null, deities: [] };
		const ids = [preset.equippedDeity1Id, preset.equippedDeity2Id, preset.equippedDeity3Id].filter(
			(id): id is number => id !== null,
		);
		const [weapons, armors, deities] = await Promise.all([
			preset.equippedWeaponId
				? executor
						.select({ name: weaponRoster.name, enhancement: userWeapons.enhancement })
						.from(userWeapons)
						.innerJoin(weaponRoster, eq(userWeapons.weaponRosterId, weaponRoster.weaponRosterId))
						.where(
							and(
								eq(userWeapons.discordId, discordId),
								eq(userWeapons.weaponId, preset.equippedWeaponId),
							),
						)
				: [],
			preset.equippedArmorId
				? executor
						.select({ name: armorRoster.name, enhancement: userArmors.enhancement })
						.from(userArmors)
						.innerJoin(armorRoster, eq(userArmors.armorRosterId, armorRoster.armorRosterId))
						.where(and(eq(userArmors.discordId, discordId), eq(userArmors.armorId, preset.equippedArmorId)))
				: [],
			ids.length
				? executor
						.select({ id: userDeities.userDeityId, name: deityRoster.name, sigils: userDeities.sigils })
						.from(userDeities)
						.innerJoin(deityRoster, eq(userDeities.deityId, deityRoster.deityId))
						.where(and(eq(userDeities.discordId, discordId), inArray(userDeities.userDeityId, ids)))
				: [],
		]);
		return {
			weapon: weapons[0] ?? null,
			armor: armors[0] ?? null,
			deities: ids.flatMap((id) => {
				const deity = deities.find((d) => d.id === id);
				return deity ? [deity] : [];
			}),
		};
	}

	async findTitleDisplay(executor: Executor, titleId: number) {
		return executor
			.select({ display: titleCatalog.display })
			.from(titleCatalog)
			.where(eq(titleCatalog.titleId, titleId))
			.limit(1);
	}
}
