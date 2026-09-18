import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { userCharacter, userPresets, userWeapons, userArmors, userDeities } from '../db/schema.js';

export class LoadoutService {
	async equip(id: string, kind: string, item: string, slot?: number): Promise<string> {
		return db.transaction(async (tx) => {
			const [c] = await tx.select().from(userCharacter).where(eq(userCharacter.discordId, id)).for('update');
			if (!c) return 'Dùng /create trước.';
			const target = slot ?? c.activePresetSlot;
			if (target !== 1 && target !== 2) return 'Preset phải là 1 hoặc 2.';
			const [preset] = await tx
				.select()
				.from(userPresets)
				.where(and(eq(userPresets.discordId, id), eq(userPresets.slot, target)));
			if (!preset) return 'Không tìm thấy preset.';
			if (kind === 'weapon') {
				const [owned] = await tx
					.select()
					.from(userWeapons)
					.where(and(eq(userWeapons.discordId, id), eq(userWeapons.weaponId, item)));
				if (!owned) return 'Bạn không sở hữu vũ khí này.';
				await tx
					.update(userPresets)
					.set({ equippedWeaponId: item, updatedAt: new Date() })
					.where(eq(userPresets.id, preset.id));
				if (target === c.activePresetSlot)
					await tx
						.update(userCharacter)
						.set({ equippedWeaponId: item })
						.where(eq(userCharacter.discordId, id));
			} else if (kind === 'armor') {
				const [owned] = await tx
					.select()
					.from(userArmors)
					.where(and(eq(userArmors.discordId, id), eq(userArmors.armorId, item)));
				if (!owned) return 'Bạn không sở hữu giáp này.';
				await tx
					.update(userPresets)
					.set({ equippedArmorId: item, updatedAt: new Date() })
					.where(eq(userPresets.id, preset.id));
				if (target === c.activePresetSlot)
					await tx
						.update(userCharacter)
						.set({ equippedArmorId: item })
						.where(eq(userCharacter.discordId, id));
			} else if (kind === 'deity' && /^\d+$/.test(item) && Number.isSafeInteger(Number(item))) {
				const [owned] = await tx
					.select()
					.from(userDeities)
					.where(and(eq(userDeities.discordId, id), eq(userDeities.userDeityId, Number(item))));
				if (!owned) return 'Bạn không sở hữu deity này.';
				await tx
					.update(userPresets)
					.set({ equippedDeity1Id: Number(item), updatedAt: new Date() })
					.where(eq(userPresets.id, preset.id));
				if (target === c.activePresetSlot)
					await tx
						.update(userCharacter)
						.set({ activeDeityId: Number(item) })
						.where(eq(userCharacter.discordId, id));
			} else return 'Loại hoặc ID không hợp lệ.';
			return `Đã trang bị ${kind} ${item} vào preset ${target}. /profile để xem chỉ số.`;
		});
	}
	async switch(id: string, slot: number): Promise<string> {
		if (slot !== 1 && slot !== 2) return 'Preset phải là 1 hoặc 2.';
		return db.transaction(async (tx) => {
			const [c] = await tx.select().from(userCharacter).where(eq(userCharacter.discordId, id)).for('update');
			if (!c) return 'Dùng /create trước.';
			const [p] = await tx
				.select()
				.from(userPresets)
				.where(and(eq(userPresets.discordId, id), eq(userPresets.slot, slot)));
			if (!p) return 'Không tìm thấy preset.';
			await tx
				.update(userCharacter)
				.set({
					activePresetSlot: slot,
					equippedWeaponId: p.equippedWeaponId,
					equippedArmorId: p.equippedArmorId,
					activeDeityId: p.equippedDeity1Id,
					activeDeityId2: p.equippedDeity2Id,
					activeDeityId3: p.equippedDeity3Id,
					activeEchoDeityId: p.equippedEchoDeityId,
				})
				.where(eq(userCharacter.discordId, id));
			return `Đang dùng preset ${slot}. Weapon: ${p.equippedWeaponId ?? 'trống'} · Armor: ${p.equippedArmorId ?? 'trống'} · Deity: ${p.equippedDeity1Id ?? 'trống'}\n/equip để thay trang bị.`;
		});
	}
}
