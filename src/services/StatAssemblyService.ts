import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { userCharacter, userPresets } from '../db/schema.js';
import { computeClassStats } from '../config/classes.js';
import { STAT_EFFECT_KEYS, type RuneEffectKey } from '../config/runes.js';
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

export interface AssembledPlayer {
	stats: AssembledPlayerStats;
	/** Combat-hook runes (COMBAT_EFFECT_KEYS) from both equipped weapon and armor, ready for RuneStrategyDecorator. */
	combatEffectRunes: SocketedRuneEffect[];
}

const STAT_TARGET: Record<string, 'atkPct' | 'critPts' | 'hpPct' | 'defPct'> = {
	sharpness: 'atkPct',
	precision: 'critPts',
	vitality: 'hpPct',
	bulwark: 'defPct',
};

/**
 * Ported from engine/statAssembly.js's buildPlayerFighter/assemblePlayerStats
 * — SIMPLIFIED (documented in README):
 *   HP  = class + armor + deity      ATK = class + weapon + deity
 *   DEF = class + armor + deity      CRIT = class + weapon (uncapped)
 * Stat-% runes (sharpness/precision/vitality/bulwark) from BOTH weapon and
 * armor sockets are SUMMED FIRST, then applied as one multiplier — NOT
 * compounded per-rune. This fixes a real bug from the first rune-integration
 * pass (M5), which multiplied atk/def once per rune sequentially.
 *
 * NOT ported (deferred, see README): pantheon slots 2/3 + resonance
 * (50%-weight secondary deities), deity Ascension/sigil scaling
 * (computeDeityProgressionStats — deity stats used here are the raw
 * curr_atk/hp/def from user_deities, i.e. pre-Ascension), weapon
 * bonus_dmg_pct tier scaling, blessings.
 */
export class StatAssemblyService {
	constructor(
		private readonly gear = new GearRepository(),
		private readonly deities = new DeityRepository(),
		private readonly runes = new RuneRepository(),
	) {}

	async assemble(discordId: string, combatClass: CombatClass, level: number): Promise<AssembledPlayer> {
		const cls = computeClassStats(combatClass, level);

		const [character] = await db
			.select()
			.from(userCharacter)
			.where(eq(userCharacter.discordId, discordId))
			.limit(1);
		const [preset] = character
			? await db
					.select()
					.from(userPresets)
					.where(and(eq(userPresets.discordId, discordId), eq(userPresets.slot, character.activePresetSlot)))
					.limit(1)
			: [];

		const weapon = preset?.equippedWeaponId
			? await this.gear.findWeaponCurrStats(db, discordId, preset.equippedWeaponId)
			: null;
		const armor = preset?.equippedArmorId
			? await this.gear.findArmorCurrStats(db, discordId, preset.equippedArmorId)
			: null;
		const deity =
			preset?.equippedDeity1Id != null ? await this.deities.findUserDeityCurrStats(db, preset.equippedDeity1Id) : null;

		const allEffects: SocketedRuneEffect[] = [
			...(preset?.equippedWeaponId ? await this.runes.findSocketedEffects(db, preset.equippedWeaponId) : []),
			...(preset?.equippedArmorId ? await this.runes.findSocketedEffects(db, preset.equippedArmorId) : []),
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
			atk: Math.floor(baseAtk * (1 + statMods.atkPct / 100) + (deity?.currAtk ?? 0)),
			hp: Math.floor(baseHp * (1 + statMods.hpPct / 100) + (deity?.currHp ?? 0)),
			def: Math.floor(baseDef * (1 + statMods.defPct / 100) + (deity?.currDef ?? 0)),
			crit: cls.crit + (weapon?.crit ?? 0) + statMods.critPts,
		};

		return { stats, combatEffectRunes };
	}
}
