/**
 * SEED DATA — weapon_roster
 * ---------------------------------------------------------------------------
 * Sửa text ở file này rồi chạy `npm run db:seed`.
 *
 * Tier hợp lệ: Common | Rare | Mythic | Legendary | Supreme
 *   (Common chỉ dùng roster — gear người chơi thường là Rare trở lên)
 * type: 'Sword' | 'Axe' | 'Spear' | 'Bow' | 'Staff' | 'Dagger' (tuỳ ý, chưa CHECK)
 *
 * ⚠ QUAN TRỌNG: weaponRosterId = 1 phải là vũ khí khởi đầu
 * "Initiate's Blade" — CharacterCreationService tra cứu roster theo TÊN
 * (STARTER_WEAPON_NAME trong config/starter.ts). Nếu đổi tên ở đây, hãy
 * đổi cả STARTER_WEAPON_NAME cho khớp.
 */

export interface WeaponSeed {
	weaponRosterId: number;
	name: string;
	type: string;
	tier: 'Common' | 'Rare' | 'Mythic' | 'Legendary' | 'Supreme';
	mythology: string;
	passiveKey: string;
	passiveName: string;
	passiveDescription: string;
	lore: string | null;
	imageFilename: string | null;
	isAvailable: boolean;
}

export const WEAPON_SEED: WeaponSeed[] = [
	// ── Starter (bắt buộc, tra cứu theo tên) ─────────────────────────────────
	{
		weaponRosterId: 1,
		name: "Initiate's Blade",
		type: 'Sword',
		tier: 'Common',
		mythology: 'Neutral',
		passiveKey: 'none',
		passiveName: 'No Passive',
		passiveDescription: 'A plain training blade issued to every new adventurer.',
		lore: 'Standard-issue steel. It has ended more arguments than wars.',
		imageFilename: null,
		isAvailable: false,
	},

	// ── Rare ─────────────────────────────────────────────────────────────────
	{
		weaponRosterId: 101,
		name: 'Kampilan of the Rajah',
		type: 'Sword',
		tier: 'Rare',
		mythology: 'Filipino',
		passiveKey: 'warlord_edge',
		passiveName: 'Warlord’s Edge',
		passiveDescription: '+5% damage against enemies with higher max HP than you.',
		lore: 'The long sword of a rajah who never lost a duel on his own shore.',
		imageFilename: null,
		isAvailable: true,
	},
	{
		weaponRosterId: 102,
		name: 'Hunter’s Sinew Bow',
		type: 'Bow',
		tier: 'Rare',
		mythology: 'Filipino',
		passiveKey: 'first_blood',
		passiveName: 'First Blood',
		passiveDescription: 'The first hit of each battle deals +10% damage.',
		lore: 'Strung with the sinew of a beast that only ever missed once.',
		imageFilename: null,
		isAvailable: true,
	},

	// ── Mythic ───────────────────────────────────────────────────────────────
	{
		weaponRosterId: 201,
		name: 'Spear of Agila',
		type: 'Spear',
		tier: 'Mythic',
		mythology: 'Filipino',
		passiveKey: 'sky_dive',
		passiveName: 'Sky Dive',
		passiveDescription: 'Grants +8% crit chance when attacking from full HP.',
		lore: 'Forged from a feather of the great eagle-god and a fallen star.',
		imageFilename: null,
		isAvailable: true,
	},

	// ── Legendary ────────────────────────────────────────────────────────────
	{
		weaponRosterId: 301,
		name: 'Kris of the Eclipse',
		type: 'Dagger',
		tier: 'Legendary',
		mythology: 'Filipino',
		passiveKey: 'eclipse_mark',
		passiveName: 'Eclipse Mark',
		passiveDescription: 'Crits apply a mark; marked targets take +15% damage for 2 rounds.',
		lore: 'Wavy-bladed and wavy-tempered: it drinks the light on the day of the eclipse.',
		imageFilename: null,
		isAvailable: true,
	},
];
