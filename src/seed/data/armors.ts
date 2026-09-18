/**
 * SEED DATA — armor_roster
 * ---------------------------------------------------------------------------
 * Sửa text ở file này rồi chạy `npm run db:seed`.
 *
 * Tier hợp lệ: Common | Rare | Mythic | Legendary | Supreme
 * type: 'Heavy' | 'Medium' | 'Light'
 *
 * ⚠ QUAN TRỌNG: armorRosterId = 1 phải là giáp khởi đầu
 * "Initiate's Garb" — CharacterCreationService tra cứu roster theo TÊN
 * (STARTER_ARMOR_NAME trong config/starter.ts).
 */

export interface ArmorSeed {
	armorRosterId: number;
	name: string;
	type: 'Heavy' | 'Medium' | 'Light';
	tier: 'Common' | 'Rare' | 'Mythic' | 'Legendary' | 'Supreme';
	mythology: string;
	passiveKey: string;
	passiveName: string;
	passiveDescription: string;
	lore: string | null;
	imageFilename: string | null;
	isAvailable: boolean;
}

export const ARMOR_SEED: ArmorSeed[] = [
	// ── Starter (bắt buộc, tra cứu theo tên) ─────────────────────────────────
	{
		armorRosterId: 1,
		name: "Initiate's Garb",
		type: 'Medium',
		tier: 'Common',
		mythology: 'Neutral',
		passiveKey: 'none',
		passiveName: 'No Passive',
		passiveDescription: 'A simple woven tunic that has saved more recruits than any doctrine.',
		lore: 'Standard-issue cloth, smelling faintly of the barracks.',
		imageFilename: null,
		isAvailable: false,
	},

	// ── Rare ─────────────────────────────────────────────────────────────────
	{
		armorRosterId: 101,
		name: 'Bakunawa Scale Mail',
		type: 'Heavy',
		tier: 'Rare',
		mythology: 'Filipino',
		passiveKey: 'serpent_hide',
		passiveName: 'Serpent Hide',
		passiveDescription: 'Reduces crit damage taken by 10%.',
		lore: 'Plates cut from a shed scale of the moon-eater. Still cold to the touch.',
		imageFilename: null,
		isAvailable: true,
	},
	{
		armorRosterId: 102,
		name: 'Diwata Silk Vest',
		type: 'Light',
		tier: 'Rare',
		mythology: 'Filipino',
		passiveKey: 'forest_blessing',
		passiveName: 'Forest Blessing',
		passiveDescription: 'Regenerates 1% max HP per round while below half HP.',
		lore: 'Woven by diwata of the middle forest; it never stains and never rots.',
		imageFilename: null,
		isAvailable: true,
	},

	// ── Mythic ───────────────────────────────────────────────────────────────
	{
		armorRosterId: 201,
		name: 'Aegis of Mayari',
		type: 'Heavy',
		tier: 'Mythic',
		mythology: 'Filipino',
		passiveKey: 'moonward',
		passiveName: 'Moonward',
		passiveDescription: 'Once per battle, survives a killing blow with 1 HP.',
		lore: 'The silver half of the war-moon, hammered into a breastplate by the moon goddess herself.',
		imageFilename: null,
		isAvailable: true,
	},
];
