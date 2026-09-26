import type { CombatClass } from '../../identity/domain/PlayerAccount.js';
import {
	DEFAULT_ARMOR_TYPE,
	DEFAULT_CRIT_DMG_PCT,
	DEFAULT_DAMAGE_TYPE,
	type ArmorType,
	type DamageType,
} from '../../../shared/config/damageTypes.js';
import { DEFAULT_BATTLE_STANCE, type BattleStance } from '../../../shared/config/skills.js';
import { COMBAT_STRIKE_EMOJIS, COMBAT_TENACITY_SHRUG } from '../../../shared/ui/text/combat.js';
import { rollChance } from '../../../shared/utils/weightedRandom.js';

export type DebuffTag =
	'bleed' | 'burn' | 'venom' | 'atk_down' | 'def_down' | 'paralyze' | 'stun' | 'dizzy' | 'blight' | 'slow';

/**
 * A status effect on one side. `value` means different things per tag:
 *  - bleed/burn: flat damage dealt at end-of-round tick
 *  - atk_down/def_down: fractional reduction (0.15 = -15%)
 *  - paralyze/stun/dizzy: presence alone matters, `value` unused
 *  - slow: fractional SPD penalty (0.25 = -25% effective SPD)
 */
export interface Debuff {
	tag: DebuffTag;
	turnsLeft: number;
	value: number;
	stacks?: number;
}

/** Tags whose application Tenacity can shrug off entirely. */
const HARD_CC_TAGS: ReadonlySet<DebuffTag> = new Set(['stun', 'paralyze', 'dizzy']);

/**
 * Single choke point for applying a debuff. Tenacity gives a flat chance
 * to shrug off incoming hard CC (stun/paralyze/dizzy); DOT/fractional tags
 * pass through unchanged. Returns the applied debuff, or null on a shrug.
 *
 * Fractional tags (atk_down/def_down/slow) share one slot per tag: a
 * re-proc keeps the strongest value and refreshes the duration, so repeat
 * procs (e.g. wing_clippers) extend pressure instead of stacking dead rows
 * that findDebuff() would never read.
 */
export function applyDebuff(
	target: CombatantState,
	debuff: { tag: DebuffTag; turnsLeft: number; value: number; stacks?: number },
	rng: () => number,
	log?: (message: string) => void,
): Debuff | null {
	if (HARD_CC_TAGS.has(debuff.tag)) {
		const ten = target.ten ?? 0;
		if (ten > 0 && rollChance(ten / 100, rng)) {
			log?.(COMBAT_TENACITY_SHRUG(combatDisplayName(target)));
			return null;
		}
	}
	if (debuff.tag === 'atk_down' || debuff.tag === 'def_down' || debuff.tag === 'slow') {
		const existing = target.debuffs.find((d) => d.tag === debuff.tag);
		if (existing) {
			existing.value = Math.max(existing.value, debuff.value);
			existing.turnsLeft = Math.max(existing.turnsLeft, debuff.turnsLeft);
			return existing;
		}
	}
	const applied: Debuff = { tag: debuff.tag, turnsLeft: debuff.turnsLeft, value: debuff.value };
	if (debuff.stacks !== undefined) applied.stacks = debuff.stacks;
	target.debuffs.push(applied);
	return applied;
}

/**
 * Per-battle scratch state for strategies and decorators. Every key is a
 * typed field with a fixed default (see `createBattleFlags`): adding a new
 * effect means adding a field here, so a typo'd key is a compile error
 * instead of a silent `undefined`. Numeric fields default to 0, booleans to
 * false, except `bakuPhase` (1, the opening phase) and
 * `swordsmanAtkStackBase` (null until the first stack accrues).
 */
export interface BattleFlags {
	// Weapon passives.
	weaponFirstBloodUsed: boolean;
	weaponSkyDiveBonus: number;
	eclipseMarkUntil: number;
	stormEchoArmed: boolean;
	// Rune combat hooks.
	wardingPct: number;
	aegisUsed: boolean;
	// Deity blessings.
	initiativeBias: number;
	blessingVeilActive: boolean;
	blessingSovereignUsed: boolean;
	// Class strategies.
	swordsmanAtkStackPct: number;
	swordsmanAtkStackBase: number | null;
	fighterBashThisHit: boolean;
	stunImmuneUntil: number;
	mageOverchargeThisHit: boolean;
	knightSecondWindUsed: boolean;
	knightBulwarkThisHit: boolean;
	archerExtraSwing: boolean;
	archerShots: number;
	archerAimedThisHit: boolean;
	// Monster AI + shared per-battle budgets.
	monsterAffixes: boolean;
	monsterRounds: number;
	regenPct: number;
	devourCharging: boolean;
	leapCharging: boolean;
	frenzyLogged: boolean;
	bakuPhase: number;
	immunityUsed: number;
	healedThisRound: number;
	/** Phase 2 skill resource (0–SKILL_RESOURCE.max) — builds on dealing/taking damage. */
	resource: number;
	/** Phase 2 skill cooldowns: skill key → rounds left. */
	skillCooldowns: Record<string, number>;
	/** Phase 4 weekly frenzy: additive damage-% rider for this battle. */
	fieldDamagePct: number;
	/** Phase 4 weekly bloodmoon: sudden death starts at round 16. */
	earlySuddenDeath: boolean;
	/** Phase 4 weekly drought: healing multiplier (1 = normal). */
	healMult: number;
}

/** Fresh per-battle flags; every combatant starts from these defaults. */
export function createBattleFlags(): BattleFlags {
	return {
		weaponFirstBloodUsed: false,
		weaponSkyDiveBonus: 0,
		eclipseMarkUntil: 0,
		stormEchoArmed: false,
		wardingPct: 0,
		aegisUsed: false,
		initiativeBias: 0,
		blessingVeilActive: false,
		blessingSovereignUsed: false,
		swordsmanAtkStackPct: 0,
		swordsmanAtkStackBase: null,
		fighterBashThisHit: false,
		stunImmuneUntil: 0,
		mageOverchargeThisHit: false,
		knightSecondWindUsed: false,
		knightBulwarkThisHit: false,
		archerExtraSwing: false,
		archerShots: 0,
		archerAimedThisHit: false,
		monsterAffixes: false,
		monsterRounds: 0,
		regenPct: 0,
		devourCharging: false,
		leapCharging: false,
		frenzyLogged: false,
		bakuPhase: 1,
		immunityUsed: 0,
		healedThisRound: 0,
		resource: 0,
		skillCooldowns: {},
		fieldDamagePct: 0,
		earlySuddenDeath: false,
		healMult: 1,
	};
}

/** One combatant's mutable state for the duration of a single battle. */
export interface CombatantState {
	name: string;
	/** Emoji hiển thị trước tên trong battle log (VD: 🐅 cho mob) — tuỳ chọn. */
	emoji?: string;
	/**
	 * Emoji vũ khí hiển thị trong đòn đánh thường; CRIT dùng emoji toàn cục.
	 * Mặc định tay không (createCombatant tự điền) — services gán khi đọc
	 * vũ khí đang equip của người chơi, ví dụ từ cột emoji của weapon_roster.
	 */
	attackEmoji?: string;
	combatClass: CombatClass | null; // null for mobs — mobs get the no-op strategy
	hp: number;
	maxHp: number;
	atk: number;
	def: number;
	crit: number; // percent, e.g. 5 means 5%
	/** Crit severity in percent (200 = ×2.0). Replaces the fixed ×2 — build crit with trade-offs. */
	critDmg: number;
	/** Flat armor penetration subtracted from effective DEF before mitigation (0 = none). */
	penFlat: number;
	/** Temporary shield HP: absorbed before hp on incoming hits (0 = none). */
	shield: number;
	/** Damage type this combatant deals — drives the counter matrix (Phase 1). */
	damageType: DamageType;
	/** Armor type this combatant wears — drives the counter matrix (Phase 1). */
	armorType: ArmorType;
	/** Speed: higher acts first each round (ties fall back to the initiative roll). */
	spd: number;
	/** Accuracy points vs the defender's evasion (see rollHit). */
	acc: number;
	/** Evasion points vs the attacker's accuracy (see rollHit). */
	eva: number;
	/** Tenacity: % chance to shrug off incoming stun/paralyze/dizzy entirely (see applyDebuff). */
	ten: number;
	/** Phase 2 equipped skill keys (max 2) — engine casts via SkillDecorator. Empty = basic attacks only. */
	skills: string[];
	/** Phase 2 battle order — drives skill selection priority. */
	stance: BattleStance;
	debuffs: Debuff[];
	immunityTags?: string[];
	/** Typed per-battle scratch space (see BattleFlags); every key starts from `createBattleFlags()`. */
	flags: BattleFlags;
}

export function findDebuff(side: CombatantState, tag: DebuffTag): Debuff | undefined {
	return side.debuffs.find((d) => d.tag === tag);
}

/** SPD after the slow snare (if any). Used by turn order. */
export function effectiveSpd(side: CombatantState): number {
	const slow = findDebuff(side, 'slow')?.value ?? 0;
	return side.spd * (1 - Math.min(0.9, Math.max(0, slow)));
}

/** P8 heal cap: all healing shares one per-round budget (8% max HP). */
export const HEAL_CAP_PCT = 0.08;

/** Phase 2 shield cap: temporary shields stack but never exceed 25% max HP. */
export const SHIELD_CAP_PCT = 0.25;

/** P8 immunity budget shared by aegis/lunar-veil/sky-sovereign: the first
 * two full nullifies per battle apply in full; further ones halve
 * (0.5) instead of nullifying. */
export const IMMUNITY_BUDGET = 2;

export function immunityMultiplier(side: CombatantState): number {
	const used = side.flags.immunityUsed;
	side.flags.immunityUsed = used + 1;
	return used < IMMUNITY_BUDGET ? 1 : 0.5;
}

/**
 * Heal through the shared per-round budget. Diversified sustain
 * (lifesteal + regen + blessings) stacks, but never out-heals the cap.
 */
export function cappedHeal(side: CombatantState, amount: number): number {
	if (amount <= 0 || side.hp <= 0) return 0;
	// Phase 4 weekly drought scales all healing (default 1 = unchanged).
	const scaled = Math.floor(amount * side.flags.healMult);
	const budget = Math.floor(side.maxHp * HEAL_CAP_PCT) - side.flags.healedThisRound;
	const healed = Math.max(0, Math.min(scaled, budget, side.maxHp - side.hp));
	if (healed > 0) {
		side.hp += healed;
		side.flags.healedThisRound = side.flags.healedThisRound + healed;
	}
	return healed;
}

/**
 * Phase 2 shield: temporary HP absorbed before real HP (see BattleAttack).
 * Stacks across casts but capped at SHIELD_CAP_PCT of max HP (anti-exploit).
 */
export function grantShield(side: CombatantState, amount: number): number {
	if (amount <= 0 || side.hp <= 0) return 0;
	const room = Math.floor(side.maxHp * SHIELD_CAP_PCT) - side.shield;
	const granted = Math.max(0, Math.min(amount, room));
	side.shield += granted;
	return granted;
}

/** Phase 2 cleanse: removes up to `count` debuffs, oldest first. */
export function cleanseDebuffs(side: CombatantState, count: number): number {
	if (count <= 0) return 0;
	const removed = Math.min(count, side.debuffs.length);
	side.debuffs.splice(0, removed);
	return removed;
}

/** ``🐅 Tiger`` — tên dạng inline code: username chứa __ không vỡ markdown Discord. */
export function combatDisplayName(c: CombatantState): string {
	return c.emoji ? `\`${c.emoji} ${c.name}\`` : `\`${c.name}\``;
}

export function createCombatant(params: {
	name: string;
	combatClass: CombatClass | null;
	hp: number;
	atk: number;
	def: number;
	crit: number;
	critDmg?: number;
	penFlat?: number;
	shield?: number;
	damageType?: DamageType;
	armorType?: ArmorType;
	spd?: number;
	acc?: number;
	eva?: number;
	ten?: number;
	skills?: string[];
	stance?: BattleStance;
	emoji?: string;
	attackEmoji?: string;
}): CombatantState {
	return {
		name: params.name,
		emoji: params.emoji,
		attackEmoji: params.attackEmoji ?? COMBAT_STRIKE_EMOJIS.bareHand,
		combatClass: params.combatClass,
		hp: params.hp,
		maxHp: params.hp,
		atk: params.atk,
		def: params.def,
		crit: params.crit,
		// Defaults reproduce the pre-Phase-1 behaviour exactly: critDmg 200 = the
		// old fixed ×2, penFlat/shield 0 = no change. Characterization snapshots
		// stay valid until content actually grants these stats.
		critDmg: params.critDmg ?? DEFAULT_CRIT_DMG_PCT,
		penFlat: params.penFlat ?? 0,
		shield: params.shield ?? 0,
		damageType: params.damageType ?? DEFAULT_DAMAGE_TYPE,
		armorType: params.armorType ?? DEFAULT_ARMOR_TYPE,
		spd: params.spd ?? 100,
		acc: params.acc ?? 0,
		eva: params.eva ?? 0,
		ten: params.ten ?? 0,
		skills: params.skills ?? [],
		stance: params.stance ?? DEFAULT_BATTLE_STANCE,
		debuffs: [],
		flags: createBattleFlags(),
	};
}
