import { ARMORS_TEXT } from '../../../shared/ui/text/catalog/armors.js';
/**
 * SEED DATA — armor_roster
 * ---------------------------------------------------------------------------
 * Text hiển thị: src/shared/ui/text/catalog/armors.ts; chạy pnpm db:seed sau khi sửa.
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
	/** Phase 3 gear set key (null = starter/không set). */
	setKey: string | null;
}

export const ARMOR_SEED: ArmorSeed[] = [
	// ── Starter (bắt buộc, tra cứu theo tên) ─────────────────────────────────
	{
		armorRosterId: 1,
		setKey: null,
		name: ARMORS_TEXT['1'].name,
		type: 'Medium',
		tier: 'Common',
		mythology: ARMORS_TEXT['1'].mythology,
		passiveKey: 'none',
		passiveName: ARMORS_TEXT['1'].passiveName,
		passiveDescription: ARMORS_TEXT['1'].passiveDescription,
		lore: ARMORS_TEXT['1'].lore,
		imageFilename: null,
		isAvailable: false,
	},

	// ── Rare ─────────────────────────────────────────────────────────────────
	{
		armorRosterId: 101,
		setKey: 'bloodfang',
		name: ARMORS_TEXT['101'].name,
		type: 'Heavy',
		tier: 'Rare',
		mythology: ARMORS_TEXT['101'].mythology,
		passiveKey: 'serpent_hide',
		passiveName: ARMORS_TEXT['101'].passiveName,
		passiveDescription: ARMORS_TEXT['101'].passiveDescription,
		lore: ARMORS_TEXT['101'].lore,
		imageFilename: null,
		isAvailable: true,
	},
	{
		armorRosterId: 102,
		setKey: 'stoneward',
		name: ARMORS_TEXT['102'].name,
		type: 'Light',
		tier: 'Rare',
		mythology: ARMORS_TEXT['102'].mythology,
		passiveKey: 'forest_blessing',
		passiveName: ARMORS_TEXT['102'].passiveName,
		passiveDescription: ARMORS_TEXT['102'].passiveDescription,
		lore: ARMORS_TEXT['102'].lore,
		imageFilename: null,
		isAvailable: true,
	},

	// ── Mythic ───────────────────────────────────────────────────────────────
	{
		armorRosterId: 201,
		setKey: 'bloodfang',
		name: ARMORS_TEXT['201'].name,
		type: 'Heavy',
		tier: 'Mythic',
		mythology: ARMORS_TEXT['201'].mythology,
		passiveKey: 'moonward',
		passiveName: ARMORS_TEXT['201'].passiveName,
		passiveDescription: ARMORS_TEXT['201'].passiveDescription,
		lore: ARMORS_TEXT['201'].lore,
		imageFilename: null,
		isAvailable: true,
	},

	// ── Supreme ──────────────────────────────────────────────────────────────
	{
		armorRosterId: 401,
		setKey: 'bloodfang',
		name: ARMORS_TEXT['401'].name,
		type: 'Heavy',
		tier: 'Supreme',
		mythology: ARMORS_TEXT['401'].mythology,
		passiveKey: 'first_dawn',
		passiveName: ARMORS_TEXT['401'].passiveName,
		passiveDescription: ARMORS_TEXT['401'].passiveDescription,
		lore: ARMORS_TEXT['401'].lore,
		imageFilename: null,
		isAvailable: true,
	},

	// ── M7 mở rộng: đa dạng loot ─────────────────────────────────────────────
	{
		armorRosterId: 103,
		setKey: 'swiftwind',
		name: ARMORS_TEXT['103'].name,
		type: 'Light',
		tier: 'Rare',
		mythology: ARMORS_TEXT['103'].mythology,
		passiveKey: 'severed_flight',
		passiveName: ARMORS_TEXT['103'].passiveName,
		passiveDescription: ARMORS_TEXT['103'].passiveDescription,
		lore: ARMORS_TEXT['103'].lore,
		imageFilename: null,
		isAvailable: true,
	},
	{
		armorRosterId: 104,
		setKey: 'bloodfang',
		name: ARMORS_TEXT['104'].name,
		type: 'Medium',
		tier: 'Rare',
		mythology: ARMORS_TEXT['104'].mythology,
		passiveKey: 'grove_guard',
		passiveName: ARMORS_TEXT['104'].passiveName,
		passiveDescription: ARMORS_TEXT['104'].passiveDescription,
		lore: ARMORS_TEXT['104'].lore,
		imageFilename: null,
		isAvailable: true,
	},
	{
		armorRosterId: 202,
		setKey: 'stoneward',
		name: ARMORS_TEXT['202'].name,
		type: 'Medium',
		tier: 'Mythic',
		mythology: ARMORS_TEXT['202'].mythology,
		passiveKey: 'wolves_feast',
		passiveName: ARMORS_TEXT['202'].passiveName,
		passiveDescription: ARMORS_TEXT['202'].passiveDescription,
		lore: ARMORS_TEXT['202'].lore,
		imageFilename: null,
		isAvailable: true,
	},
	{
		armorRosterId: 203,
		setKey: 'swiftwind',
		name: ARMORS_TEXT['203'].name,
		type: 'Heavy',
		tier: 'Mythic',
		mythology: ARMORS_TEXT['203'].mythology,
		passiveKey: 'dawn_roll',
		passiveName: ARMORS_TEXT['203'].passiveName,
		passiveDescription: ARMORS_TEXT['203'].passiveDescription,
		lore: ARMORS_TEXT['203'].lore,
		imageFilename: null,
		isAvailable: true,
	},
	{
		armorRosterId: 302,
		setKey: 'bloodfang',
		name: ARMORS_TEXT['302'].name,
		type: 'Light',
		tier: 'Legendary',
		mythology: ARMORS_TEXT['302'].mythology,
		passiveKey: 'tide_tempest',
		passiveName: ARMORS_TEXT['302'].passiveName,
		passiveDescription: ARMORS_TEXT['302'].passiveDescription,
		lore: ARMORS_TEXT['302'].lore,
		imageFilename: null,
		isAvailable: true,
	},
	{
		armorRosterId: 402,
		setKey: 'stoneward',
		name: ARMORS_TEXT['402'].name,
		type: 'Heavy',
		tier: 'Supreme',
		mythology: ARMORS_TEXT['402'].mythology,
		passiveKey: 'gorgon_gaze',
		passiveName: ARMORS_TEXT['402'].passiveName,
		passiveDescription: ARMORS_TEXT['402'].passiveDescription,
		lore: ARMORS_TEXT['402'].lore,
		imageFilename: null,
		isAvailable: true,
	},
];
