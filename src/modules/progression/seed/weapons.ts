import { WEAPONS_TEXT } from '../../../shared/ui/text/catalog/weapons.js';
/**
 * SEED DATA — weapon_roster
 * ---------------------------------------------------------------------------
 * Text hiển thị: src/shared/ui/text/catalog/weapons.ts; chạy pnpm db:seed sau khi sửa.
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
		name: WEAPONS_TEXT['1'].name,
		type: 'Sword',
		tier: 'Common',
		mythology: WEAPONS_TEXT['1'].mythology,
		passiveKey: 'none',
		passiveName: WEAPONS_TEXT['1'].passiveName,
		passiveDescription: WEAPONS_TEXT['1'].passiveDescription,
		lore: WEAPONS_TEXT['1'].lore,
		imageFilename: null,
		isAvailable: false,
	},

	// ── Rare ─────────────────────────────────────────────────────────────────
	{
		weaponRosterId: 101,
		name: WEAPONS_TEXT['101'].name,
		type: 'Sword',
		tier: 'Rare',
		mythology: WEAPONS_TEXT['101'].mythology,
		passiveKey: 'warlord_edge',
		passiveName: WEAPONS_TEXT['101'].passiveName,
		passiveDescription: WEAPONS_TEXT['101'].passiveDescription,
		lore: WEAPONS_TEXT['101'].lore,
		imageFilename: null,
		isAvailable: true,
	},
	{
		weaponRosterId: 102,
		name: WEAPONS_TEXT['102'].name,
		type: 'Bow',
		tier: 'Rare',
		mythology: WEAPONS_TEXT['102'].mythology,
		passiveKey: 'first_blood',
		passiveName: WEAPONS_TEXT['102'].passiveName,
		passiveDescription: WEAPONS_TEXT['102'].passiveDescription,
		lore: WEAPONS_TEXT['102'].lore,
		imageFilename: null,
		isAvailable: true,
	},

	// ── Mythic ───────────────────────────────────────────────────────────────
	{
		weaponRosterId: 201,
		name: WEAPONS_TEXT['201'].name,
		type: 'Spear',
		tier: 'Mythic',
		mythology: WEAPONS_TEXT['201'].mythology,
		passiveKey: 'sky_dive',
		passiveName: WEAPONS_TEXT['201'].passiveName,
		passiveDescription: WEAPONS_TEXT['201'].passiveDescription,
		lore: WEAPONS_TEXT['201'].lore,
		imageFilename: null,
		isAvailable: true,
	},

	// ── Legendary ────────────────────────────────────────────────────────────
	{
		weaponRosterId: 301,
		name: WEAPONS_TEXT['301'].name,
		type: 'Dagger',
		tier: 'Legendary',
		mythology: WEAPONS_TEXT['301'].mythology,
		passiveKey: 'eclipse_mark',
		passiveName: WEAPONS_TEXT['301'].passiveName,
		passiveDescription: WEAPONS_TEXT['301'].passiveDescription,
		lore: WEAPONS_TEXT['301'].lore,
		imageFilename: null,
		isAvailable: true,
	},

	// ── Supreme ──────────────────────────────────────────────────────────────
	{
		weaponRosterId: 401,
		name: WEAPONS_TEXT['401'].name,
		type: 'Sword',
		tier: 'Supreme',
		mythology: WEAPONS_TEXT['401'].mythology,
		passiveKey: 'sky_sunder',
		passiveName: WEAPONS_TEXT['401'].passiveName,
		passiveDescription: WEAPONS_TEXT['401'].passiveDescription,
		lore: WEAPONS_TEXT['401'].lore,
		imageFilename: null,
		isAvailable: true,
	},

	// ── M7 mở rộng: đa dạng loot ─────────────────────────────────────────────
	{
		weaponRosterId: 103,
		name: WEAPONS_TEXT['103'].name,
		type: 'Spear',
		tier: 'Rare',
		mythology: WEAPONS_TEXT['103'].mythology,
		passiveKey: 'eagle_dive',
		passiveName: WEAPONS_TEXT['103'].passiveName,
		passiveDescription: WEAPONS_TEXT['103'].passiveDescription,
		lore: WEAPONS_TEXT['103'].lore,
		imageFilename: null,
		isAvailable: true,
	},
	{
		weaponRosterId: 104,
		name: WEAPONS_TEXT['104'].name,
		type: 'Dagger',
		tier: 'Rare',
		mythology: WEAPONS_TEXT['104'].mythology,
		passiveKey: 'twin_sting',
		passiveName: WEAPONS_TEXT['104'].passiveName,
		passiveDescription: WEAPONS_TEXT['104'].passiveDescription,
		lore: WEAPONS_TEXT['104'].lore,
		imageFilename: null,
		isAvailable: true,
	},
	{
		weaponRosterId: 202,
		name: WEAPONS_TEXT['202'].name,
		type: 'Axe',
		tier: 'Mythic',
		mythology: WEAPONS_TEXT['202'].mythology,
		passiveKey: 'storm_echo',
		passiveName: WEAPONS_TEXT['202'].passiveName,
		passiveDescription: WEAPONS_TEXT['202'].passiveDescription,
		lore: WEAPONS_TEXT['202'].lore,
		imageFilename: null,
		isAvailable: true,
	},
	{
		weaponRosterId: 203,
		name: WEAPONS_TEXT['203'].name,
		type: 'Spear',
		tier: 'Mythic',
		mythology: WEAPONS_TEXT['203'].mythology,
		passiveKey: 'soul_weigh',
		passiveName: WEAPONS_TEXT['203'].passiveName,
		passiveDescription: WEAPONS_TEXT['203'].passiveDescription,
		lore: WEAPONS_TEXT['203'].lore,
		imageFilename: null,
		isAvailable: true,
	},
	{
		weaponRosterId: 302,
		name: WEAPONS_TEXT['302'].name,
		type: 'Sword',
		tier: 'Legendary',
		mythology: WEAPONS_TEXT['302'].mythology,
		passiveKey: 'grass_cleaver',
		passiveName: WEAPONS_TEXT['302'].passiveName,
		passiveDescription: WEAPONS_TEXT['302'].passiveDescription,
		lore: WEAPONS_TEXT['302'].lore,
		imageFilename: null,
		isAvailable: true,
	},
	{
		weaponRosterId: 303,
		name: WEAPONS_TEXT['303'].name,
		type: 'Spear',
		tier: 'Legendary',
		mythology: WEAPONS_TEXT['303'].mythology,
		passiveKey: 'oath_pierce',
		passiveName: WEAPONS_TEXT['303'].passiveName,
		passiveDescription: WEAPONS_TEXT['303'].passiveDescription,
		lore: WEAPONS_TEXT['303'].lore,
		imageFilename: null,
		isAvailable: true,
	},
	{
		weaponRosterId: 402,
		name: WEAPONS_TEXT['402'].name,
		type: 'Spear',
		tier: 'Supreme',
		mythology: WEAPONS_TEXT['402'].mythology,
		passiveKey: 'solar_barque',
		passiveName: WEAPONS_TEXT['402'].passiveName,
		passiveDescription: WEAPONS_TEXT['402'].passiveDescription,
		lore: WEAPONS_TEXT['402'].lore,
		imageFilename: null,
		isAvailable: true,
	},
];
