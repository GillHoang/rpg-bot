/**
 * SEED DATA — mob_roster
 * ---------------------------------------------------------------------------
 * Sửa toàn bộ text (tên, skill, mô tả) ở file này rồi chạy `npm run db:seed`.
 *
 * mobType : 'regular' (mob thường trong /raid) | 'elite' | 'boss'
 *           — RaidService hiện chỉ roll mobType='regular'.
 * hpPerLevel / atkPerLevel / defPerLevel: cộng dồn mỗi cấp của người chơi
 *           (stat = base + perLevel * (level - 1)).
 * immunityTags / specialFlags: mảng JSON (hiện engine M3 chưa đọc, để sẵn).
 */

export interface MobSeed {
	mobId: number;
	name: string;
	mythology: string;
	mobType: 'regular' | 'elite' | 'boss';
	baseHp: number;
	baseAtk: number;
	baseDef: number;
	baseCrit: number;
	hpPerLevel: number;
	atkPerLevel: number;
	defPerLevel: number;
	skillKey: string;
	skillName: string;
	skillDescription: string;
	immunityTags: string[];
	specialFlags: string[];
}

export const MOB_SEED: MobSeed[] = [
	// ── Regular ──────────────────────────────────────────────────────────────
	{
		mobId: 1,
		name: 'Sigbin',
		mythology: 'Filipino',
		mobType: 'regular',
		baseHp: 550,
		baseAtk: 120,
		baseDef: 60,
		baseCrit: 3.0,
		hpPerLevel: 45,
		atkPerLevel: 10,
		defPerLevel: 5,
		skillKey: 'blood_moon_leap',
		skillName: 'Blood Moon Leap',
		skillDescription: 'Leaps at the target under the blood moon, ignoring a fraction of armor.',
		immunityTags: [],
		specialFlags: [],
	},
	{
		mobId: 2,
		name: 'Tiktik',
		mythology: 'Filipino',
		mobType: 'regular',
		baseHp: 480,
		baseAtk: 105,
		baseDef: 45,
		baseCrit: 5.0,
		hpPerLevel: 40,
		atkPerLevel: 9,
		defPerLevel: 4,
		skillKey: 'wing_clippers',
		skillName: 'Wing Clippers',
		skillDescription: "The tiktik's detached wings swoop down to shred the unwary.",
		immunityTags: [],
		specialFlags: [],
	},
	{
		mobId: 3,
		name: 'Tikbalang',
		mythology: 'Filipino',
		mobType: 'regular',
		baseHp: 700,
		baseAtk: 135,
		baseDef: 80,
		baseCrit: 2.0,
		hpPerLevel: 55,
		atkPerLevel: 11,
		defPerLevel: 6,
		skillKey: 'trail_haze',
		skillName: 'Trail Haze',
		skillDescription: 'Spins the traveler around in circles,clouding their aim before striking.',
		immunityTags: [],
		specialFlags: [],
	},
	{
		mobId: 4,
		name: 'Kapre',
		mythology: 'Filipino',
		mobType: 'regular',
		baseHp: 820,
		baseAtk: 110,
		baseDef: 95,
		baseCrit: 1.0,
		hpPerLevel: 65,
		atkPerLevel: 9,
		defPerLevel: 7,
		skillKey: 'cigar_smoke',
		skillName: 'Cigar Smoke',
		skillDescription: "Exhales thick cigar smoke that chokes and dulls the enemy's blows.",
		immunityTags: [],
		specialFlags: [],
	},

	// ── Elite (loot branch chưa port — chỉ seed sẵn) ─────────────────────────
	{
		mobId: 101,
		name: 'Aswang Queen',
		mythology: 'Filipino',
		mobType: 'elite',
		baseHp: 1500,
		baseAtk: 220,
		baseDef: 130,
		baseCrit: 6.0,
		hpPerLevel: 90,
		atkPerLevel: 16,
		defPerLevel: 9,
		skillKey: 'flesh_feast',
		skillName: 'Flesh Feast',
		skillDescription: 'Devours flesh mid-battle to regenerate her own body.',
		immunityTags: ['poison'],
		specialFlags: ['lifesteal'],
	},

	// ── Boss (mechanics riêng chưa port — seed sẵn) ──────────────────────────
	{
		mobId: 201,
		name: 'Bakunawa, Eater of Moons',
		mythology: 'Filipino',
		mobType: 'boss',
		baseHp: 4000,
		baseAtk: 350,
		baseDef: 220,
		baseCrit: 4.0,
		hpPerLevel: 180,
		atkPerLevel: 25,
		defPerLevel: 14,
		skillKey: 'moon_threshold',
		skillName: 'Moon Threshold',
		skillDescription: 'Below half HP, the serpent enters eclipse: all damage dealt is amplified.',
		immunityTags: ['stun'],
		specialFlags: ['phase_two'],
	},
];
