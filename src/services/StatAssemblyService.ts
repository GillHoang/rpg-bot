import { eq, and } from 'drizzle-orm';
import { db, type Executor } from '../db/client.js';
import { userCharacter, userPresets } from '../db/schema.js';
import { computeClassStats } from '../config/classes.js';
import { STAT_EFFECT_KEYS, type RuneEffectKey } from '../config/runes.js';
import { blessingStrength, PANTHEON_SLOT_WEIGHT, resonanceBonus, type BlessingKey } from '../config/blessings.js';
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

interface PantheonEntry {
	slot: number;
	info: {
		currAtk: number;
		currHp: number;
		currDef: number;
		mythology: string;
		blessingKey: string;
		blessingScaling: string;
		sigils: number;
	};
}

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
		const preset = await this.activePreset(executor, discordId);

		const weapon = preset?.equippedWeaponId
			? await this.gear.findWeaponCurrStats(executor, discordId, preset.equippedWeaponId)
			: null;
		const armor = preset?.equippedArmorId
			? await this.gear.findArmorCurrStats(executor, discordId, preset.equippedArmorId)
			: null;

		const pantheon = await this.collectPantheon(executor, preset);
		const resonance = resonanceBonus(pantheon.map((p) => p.info.mythology));
		const deityStats = this.pantheonStats(pantheon, resonance);
		const blessings = this.leadBlessing(pantheon);
		const { statMods, combatEffectRunes } = await this.collectRunes(executor, preset);

		const baseAtk = cls.atk + (weapon?.currAtk ?? 0);
		const baseHp = cls.hp + (armor?.currHp ?? 0);
		const baseDef = cls.def + (armor?.currDef ?? 0);

		const stats: AssembledPlayerStats = {
			atk: Math.floor(baseAtk * (1 + statMods.atkPct) + deityStats.atk),
			hp: Math.floor(baseHp * (1 + statMods.hpPct) + deityStats.hp),
			def: Math.floor(baseDef * (1 + statMods.defPct) + deityStats.def),
			crit: cls.crit + (weapon?.crit ?? 0) + statMods.critPts * 100,
		};

		return { stats, combatEffectRunes, blessings };
	}

	private async activePreset(executor: Executor, discordId: string) {
		const [character] = await executor
			.select()
			.from(userCharacter)
			.where(eq(userCharacter.discordId, discordId))
			.limit(1);
		if (!character) return null;
		const [preset] = await executor
			.select()
			.from(userPresets)
			.where(and(eq(userPresets.discordId, discordId), eq(userPresets.slot, character.activePresetSlot)))
			.limit(1);
		return preset ?? null;
	}

	private async collectPantheon(
		executor: Executor,
		preset: typeof userPresets.$inferSelect | null,
	): Promise<PantheonEntry[]> {
		const slotIds = [preset?.equippedDeity1Id, preset?.equippedDeity2Id, preset?.equippedDeity3Id];
		const pantheon: PantheonEntry[] = [];
		for (const [slot, slotId] of slotIds.entries()) {
			if (slotId == null) continue;
			const info = await this.deities.findUserDeityAssemblyInfo(executor, slotId);
			if (info) pantheon.push({ slot, info });
		}
		return pantheon;
	}

	private pantheonStats(pantheon: PantheonEntry[], resonance: number): { atk: number; hp: number; def: number } {
		let atk = 0;
		let hp = 0;
		let def = 0;
		for (const { slot, info } of pantheon) {
			const weight = PANTHEON_SLOT_WEIGHT[slot];
			atk += info.currAtk * weight;
			hp += info.currHp * weight;
			def += info.currDef * weight;
		}
		return {
			atk: Math.floor(atk * (1 + resonance)),
			hp: Math.floor(hp * (1 + resonance)),
			def: Math.floor(def * (1 + resonance)),
		};
	}

	private leadBlessing(pantheon: PantheonEntry[]): AssembledBlessing[] {
		const lead = pantheon.find((p) => p.slot === 0);
		if (!lead) return [];
		return [
			{
				key: lead.info.blessingKey as BlessingKey,
				strength: blessingStrength(lead.info.blessingScaling, lead.info.sigils),
			},
		];
	}

	private async collectRunes(
		executor: Executor,
		preset: typeof userPresets.$inferSelect | null,
	): Promise<{
		statMods: { atkPct: number; hpPct: number; defPct: number; critPts: number };
		combatEffectRunes: SocketedRuneEffect[];
	}> {
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
		return { statMods, combatEffectRunes };
	}
}
