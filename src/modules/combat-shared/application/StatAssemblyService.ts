import { requirePersistence, type PersistenceContext } from '../../../shared/kernel/persistence.js';
import { PlayerLoadoutQueryRepository } from '../../progression/infrastructure/PlayerLoadoutQueryRepository.js';
import type { Executor } from '../../../db/client.js';
import type { userPresets } from '../../../db/schema.js';
import { computeClassStats, computeClassSecondaryStats } from '../../../shared/config/classes.js';
import { STAT_EFFECT_KEYS, type RuneEffectKey } from '../../../shared/config/runes.js';
import {
	blessingStrength,
	PANTHEON_SLOT_WEIGHT,
	resonanceBonus,
	type BlessingKey,
} from '../../../shared/config/blessings.js';
import { GearRepository } from '../../progression/infrastructure/GearRepository.js';
import { DeityService } from '../../progression/application/DeityService.js';
import { RuneRepository, type SocketedRuneEffect } from '../../progression/infrastructure/RuneRepository.js';
import type { CombatClass } from '../../identity/domain/PlayerAccount.js';

export interface AssembledPlayerStats {
	atk: number;
	hp: number;
	def: number;
	crit: number;
	spd: number;
	acc: number;
	eva: number;
	ten: number;
}

export interface AssembledBlessing {
	key: BlessingKey;
	strength: number;
}

export interface AssembledPlayer {
	stats: AssembledPlayerStats;
	/** Combat-hook runes from both equipped weapon and armor, ready for RuneStrategyDecorator. */
	combatEffectRunes: SocketedRuneEffect[];
	/** Blessing of the pantheon lead (slot 1) with its Sigil-derived strength, ready for DeityBlessingDecorator. */
	blessings: AssembledBlessing[];
}

const STAT_TARGET: Record<string, 'atkPct' | 'critPts' | 'hpPct' | 'defPct' | 'spdPct' | 'accPts'> = {
	sharpness: 'atkPct',
	precision: 'critPts',
	vitality: 'hpPct',
	bulwark: 'defPct',
	swiftness: 'spdPct',
	'eagle-eye': 'accPts',
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

export interface StatAssemblyDependencies {
	persistence: PersistenceContext;
	queries?: Pick<PlayerLoadoutQueryRepository, 'findCharacter' | 'findPreset'>;
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
 * DeityService computes current Sigil stats at read time. Ascension is
 * prestige only. Blessings come from every equipped pantheon slot, weighted
 * by slot (slot 1 full, slot 2 ×0.5, slot 3 ×0.25 — same weights as stats);
 * duplicate blessing keys merge by strongest strength.
 * strength = 0.5 + 0.05×sigils for scalable blessings, 1 for binary.
 */

export class StatAssemblyService {
	private readonly persistence: PersistenceContext;
	private readonly gear: Pick<GearRepository, 'findWeaponCurrStats' | 'findArmorCurrStats'>;
	private readonly deities: Pick<DeityService, 'findUserDeityAssemblyInfo'>;
	private readonly runes: Pick<RuneRepository, 'findSocketedEffects'>;
	private readonly queries: NonNullable<StatAssemblyDependencies['queries']>;
	constructor(
		gear?: Pick<GearRepository, 'findWeaponCurrStats' | 'findArmorCurrStats'>,
		deities?: Pick<DeityService, 'findUserDeityAssemblyInfo'>,
		runes?: Pick<RuneRepository, 'findSocketedEffects'>,
		options: StatAssemblyDependencies = {} as StatAssemblyDependencies,
	) {
		this.persistence = requirePersistence(options, 'StatAssemblyService');
		this.gear = gear ?? new GearRepository();
		this.deities = deities ?? new DeityService();
		this.runes = runes ?? new RuneRepository();
		this.queries = options.queries ?? new PlayerLoadoutQueryRepository();
	}

	async assemble(
		discordId: string,
		combatClass: CombatClass,
		level: number,
		executor: Executor = this.persistence.executor,
		suppliedPreset?: typeof userPresets.$inferSelect | null,
	): Promise<AssembledPlayer> {
		const cls = computeClassStats(combatClass, level);
		const sec = computeClassSecondaryStats(combatClass, level);
		const preset = suppliedPreset !== undefined ? suppliedPreset : await this.activePreset(executor, discordId);

		const weapon = preset?.equippedWeaponId
			? await this.gear.findWeaponCurrStats(executor, discordId, preset.equippedWeaponId)
			: null;
		const armor = preset?.equippedArmorId
			? await this.gear.findArmorCurrStats(executor, discordId, preset.equippedArmorId)
			: null;

		const pantheon = await this.collectPantheon(executor, preset);
		const resonance = resonanceBonus(pantheon.map((p) => p.info.mythology));
		const deityStats = this.pantheonStats(pantheon, resonance);
		const blessings = this.allBlessings(pantheon);
		const { statMods, combatEffectRunes } = await this.collectRunes(executor, preset);

		const baseAtk = cls.atk + (weapon?.currAtk ?? 0);
		const baseHp = cls.hp + (armor?.currHp ?? 0);
		const baseDef = cls.def + (armor?.currDef ?? 0);

		const stats: AssembledPlayerStats = {
			atk: Math.floor(baseAtk * (1 + statMods.atkPct) + deityStats.atk),
			hp: Math.floor(baseHp * (1 + statMods.hpPct) + deityStats.hp),
			def: Math.floor(baseDef * (1 + statMods.defPct) + deityStats.def),
			crit: cls.crit + (weapon?.crit ?? 0) + statMods.critPts * 100,
			spd: Math.floor(sec.spd * (1 + statMods.spdPct)),
			acc: sec.acc + statMods.accPts * 100,
			eva: sec.eva,
			ten: sec.ten,
		};

		return { stats, combatEffectRunes, blessings };
	}

	private async activePreset(executor: Executor, discordId: string) {
		const [character] = await this.queries.findCharacter(executor, discordId);
		if (!character) return null;
		const [preset] = await this.queries.findPreset(executor, discordId, character.activePresetSlot);
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

	private allBlessings(pantheon: PantheonEntry[]): AssembledBlessing[] {
		const merged = new Map<BlessingKey, number>();
		for (const { slot, info } of pantheon) {
			const key = info.blessingKey as BlessingKey;
			const strength = blessingStrength(info.blessingScaling, info.sigils) * PANTHEON_SLOT_WEIGHT[slot];
			merged.set(key, Math.max(merged.get(key) ?? 0, strength));
		}
		return [...merged.entries()].map(([key, strength]) => ({ key, strength }));
	}

	private async collectRunes(
		executor: Executor,
		preset: typeof userPresets.$inferSelect | null,
	): Promise<{
		statMods: { atkPct: number; hpPct: number; defPct: number; critPts: number; spdPct: number; accPts: number };
		combatEffectRunes: SocketedRuneEffect[];
	}> {
		const allEffects: SocketedRuneEffect[] = [
			...(preset?.equippedWeaponId
				? await this.runes.findSocketedEffects(executor, preset.equippedWeaponId)
				: []),
			...(preset?.equippedArmorId ? await this.runes.findSocketedEffects(executor, preset.equippedArmorId) : []),
		];

		const statMods = { atkPct: 0, hpPct: 0, defPct: 0, critPts: 0, spdPct: 0, accPts: 0 };
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
