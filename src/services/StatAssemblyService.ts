import { eq, and } from 'drizzle-orm';
import { db, type Executor } from '../db/client.js';
import { userCharacter, userPresets } from '../db/schema.js';
import { computeClassStats } from '../config/classes.js';
import { STAT_EFFECT_KEYS, type RuneEffectKey } from '../config/runes.js';
import { blessingStrength, resonanceBonus, type BlessingKey } from '../config/blessings.js';
import { GearRepository } from '../repositories/GearRepository.js';
import { DeityRepository } from '../repositories/DeityRepository.js';
import { RuneRepository, type SocketedRuneEffect } from '../repositories/RuneRepository.js';
import type { CombatClass } from '../domain/entities/PlayerAccount.js';

export interface AssembledPlayerStats {
	atk: number;
	hp: number;
	def: number;
	crit: number;
}

export interface AssembledBlessing {
	key: BlessingKey;
	strength: number;
}

export interface AssembledPlayer {
	stats: AssembledPlayerStats;
	/** Combat-hook runes (COMBAT_EFFECT_KEYS) from both equipped weapon and armor, ready for RuneStrategyDecorator. */
	combatEffectRunes: SocketedRuneEffect[];
	/** Blessing of the pantheon lead (slot 1) with its Sigil-derived strength, ready for DeityBlessingDecorator. */
	blessings: AssembledBlessing[];
}

const STAT_TARGET: Record<string, 'atkPct' | 'critPts' | 'hpPct' | 'defPct'> = {
	sharpness: 'atkPct',
	precision: 'critPts',
	vitality: 'hpPct',
	bulwark: 'defPct',
};

/**
 * Ported from engine/statAssembly.js's buildPlayerFighter/assemblePlayerStats,
 * extended with the M7 pantheon:
 *   HP  = class + armor + deities      ATK = class + weapon + deities
 *   DEF = class + armor + deities      CRIT = class + weapon (uncapped)
 * Deity slots follow the pantheon weights (slot 1 full, slot 2 ×0.5, slot 3
 * ×0.25 — config/blessings.ts PANTHEON_SLOT_WEIGHT). Resonance: 2 equipped
 * deities sharing a mythology +10% of the deity contribution, 3 sharing +20%.
 * Stat-% runes (sharpness/precision/vitality/bulwark) from BOTH weapon and
 * armor sockets are SUMMED FIRST, then applied as one multiplier — NOT
 * compounded per-rune.
 *
 * DeityRepository computes current Sigil stats at read time. Ascension is
 * prestige only. Blessings come from the pantheon lead (slot 1) only;
 * strength = 0.5 + 0.05×sigils for scalable blessings, 1 for binary.
 */
export class StatAssemblyService {
	constructor(
		private readonly gear = new GearRepository(),
		private readonly deities = new DeityRepository(),
		private readonly runes = new RuneRepository(),
	) {}

	async assemble(
		discordId: string,
		combatClass: CombatClass,
		level: number,
		executor: Executor = db,
	): Promise<AssembledPlayer> {
		const cls = computeClassStats(combatClass, level);

		const [character] = await executor
			.select()
			.from(userCharacter)
			.where(eq(userCharacter.discordId, discordId))
			.limit(1);
		const [preset] = character
			? await executor
					.select()
					.from(userPresets)
					.where(and(eq(userPresets.discordId, discordId), eq(userPresets.slot, character.activePresetSlot)))
					.limit(1)
			: [];

		const weapon = preset?.equippedWeaponId
			? await this.gear.findWeaponCurrStats(executor, discordId, preset.equippedWeaponId)
			: null;
		const armor = preset?.equippedArmorId
			? await this.gear.findArmorCurrStats(executor, discordId, preset.equippedArmorId)
			: null;

		const pantheonSlotIds = [preset?.equippedDeity1Id, preset?.equippedDeity2Id, preset?.equippedDeity3Id];
		const pantheon = [];
		for (const [index, slotId] of pantheonSlotIds.entries()) {
			if (slotId == null) continue;
			const info = await this.deities.findUserDeityAssemblyInfo(executor, slotId);
			if (info) pantheon.push({ slot: index, info });
		}
		const resonance = resonanceBonus(pantheon.map((p) => p.info.mythology));

		let deityAtk = 0;
		let deityHp = 0;
		let deityDef = 0;
		for (const { slot, info } of pantheon) {
			const weight = slot === 0 ? 1 : slot === 1 ? 0.5 : 0.25;
			deityAtk += info.currAtk * weight;
			deityHp += info.currHp * weight;
			deityDef += info.currDef * weight;
		}
		deityAtk = Math.floor(deityAtk * (1 + resonance));
		deityHp = Math.floor(deityHp * (1 + resonance));
		deityDef = Math.floor(deityDef * (1 + resonance));

		const blessings: AssembledBlessing[] = [];
		const lead = pantheon.find((p) => p.slot === 0);
		if (lead) {
			blessings.push({
				key: lead.info.blessingKey as BlessingKey,
				strength: blessingStrength(lead.info.blessingScaling, lead.info.sigils),
			});
		}

		const allEffects: SocketedRuneEffect[] = [
			...(preset?.equippedWeaponId
				? await this.runes.findSocketedEffects(executor, preset.equippedWeaponId)
				: []),
			...(preset?.equippedArmorId ? await this.runes.findSocketedEffects(executor, preset.equippedArmorId) : []),
		];

		const statMods = { atkPct: 0, hpPct: 0, defPct: 0, critPts: 0 };
		const combatEffectRunes: SocketedRuneEffect[] = [];
		for (const effect of allEffects) {
			if ((STAT_EFFECT_KEYS as readonly RuneEffectKey[]).includes(effect.effectKey)) {
				statMods[STAT_TARGET[effect.effectKey]!] += effect.value;
			} else {
				combatEffectRunes.push(effect);
			}
		}

		const baseAtk = cls.atk + (weapon?.currAtk ?? 0);
		const baseHp = cls.hp + (armor?.currHp ?? 0);
		const baseDef = cls.def + (armor?.currDef ?? 0);

		const stats: AssembledPlayerStats = {
			atk: Math.floor(baseAtk * (1 + statMods.atkPct) + deityAtk),
			hp: Math.floor(baseHp * (1 + statMods.hpPct) + deityHp),
			def: Math.floor(baseDef * (1 + statMods.defPct) + deityDef),
			crit: cls.crit + (weapon?.crit ?? 0) + statMods.critPts * 100,
		};

		return { stats, combatEffectRunes, blessings };
	}
}
