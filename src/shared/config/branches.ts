/**
 * Phase 3 class branches (battle-upgrade-plan.md §Trục C).
 *
 * Mỗi class có 2 nhánh, chọn ở Lv.40+ qua /branch. Nhánh là stat tilt
 * (cùng từ vựng statMods) áp trong StatAssembly — không chạm strategy nên
 * không vỡ characterization. Đổi nhánh tự do (đa dạng build, không monetize).
 */

export interface ClassBranchDef {
	key: string;
	combatClass: string;
	tilt: {
		atkPct?: number;
		hpPct?: number;
		defPct?: number;
		critPts?: number;
		spdPct?: number;
	};
}

/** Cấp tối thiểu để chọn nhánh. */
export const BRANCH_MIN_LEVEL = 40;

export const CLASS_BRANCHES: Readonly<Record<string, ClassBranchDef>> = {
	duelist: {
		key: 'duelist',
		combatClass: 'Swordsman',
		tilt: { atkPct: 0.1, hpPct: -0.05 },
	},
	blademaster: {
		key: 'blademaster',
		combatClass: 'Swordsman',
		tilt: { critPts: 0.05, spdPct: 0.05, defPct: -0.05 },
	},
	brawler: {
		key: 'brawler',
		combatClass: 'Fighter',
		tilt: { atkPct: 0.08, defPct: -0.05 },
	},
	juggernaut: {
		key: 'juggernaut',
		combatClass: 'Fighter',
		tilt: { hpPct: 0.1, atkPct: -0.03 },
	},
	pyromancer: {
		key: 'pyromancer',
		combatClass: 'Mage',
		tilt: { atkPct: 0.12, defPct: -0.08 },
	},
	arcanist: {
		key: 'arcanist',
		combatClass: 'Mage',
		tilt: { critPts: 0.04, hpPct: 0.05 },
	},
	guardian: {
		key: 'guardian',
		combatClass: 'Knight',
		tilt: { defPct: 0.1, hpPct: 0.05, atkPct: -0.05 },
	},
	crusader: {
		key: 'crusader',
		combatClass: 'Knight',
		tilt: { atkPct: 0.08, defPct: -0.03 },
	},
	sharpshooter: {
		key: 'sharpshooter',
		combatClass: 'Archer',
		tilt: { critPts: 0.05, atkPct: 0.05, hpPct: -0.05 },
	},
	ranger: {
		key: 'ranger',
		combatClass: 'Archer',
		tilt: { spdPct: 0.08, hpPct: 0.05, atkPct: -0.02 },
	},
};

export function branchesForClass(combatClass: string): ClassBranchDef[] {
	return Object.values(CLASS_BRANCHES).filter((b) => b.combatClass === combatClass);
}
