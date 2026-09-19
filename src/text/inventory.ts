import type { usersBag } from '../db/schema.js';
export function bagSummary(b: typeof usersBag.$inferSelect): string {
	return (
		`Credux: **${b.credux.toLocaleString()}** · Belief Shards: **${b.beliefShards.toLocaleString()}**\n` +
		`Rương: Silver ${b.silverChest} · Gold ${b.goldChest} · Boss Treasure ${b.bossTreasureChest} · Boss Golden ${b.bossGoldenChest}\n` +
		`Essence: Epic ${b.epicEssence} · Mythic ${b.mythicEssence} · Legendary ${b.legendaryEssence} · Supreme ${b.supremeEssence}\n` +
		'`/open` mở rương · `/runes shop` mua rune · `/inventory` tra ID · `/deities` xem deity'
	);
}

// --- Embed /inventory · /deities ---
export const INVENTORY_DESCRIPTION = 'Xem tài nguyên và ID vật phẩm';
export const INVENTORY_CATEGORY_OPTION_DESC = 'Loại vật phẩm';
export const INVENTORY_PAGE_OPTION_DESC = 'Trang (8 vật phẩm/trang)';
export const INVENTORY_TITLE = (category: string, page: number): string => `Inventory · ${category} · Trang ${page}`;
export const INVENTORY_EMPTY_PAGE = 'Trang trống.';
export const INVENTORY_FOOTER = '/equip · /enhance · /socket · Đổi page để xem tiếp';

export const DEITIES_DESCRIPTION = 'Xem ID, Sigil và chỉ số deity';
export const DEITIES_PAGE_OPTION_DESC = 'Trang';
export const DEITIES_TITLE = (page: number): string => `Deities · Trang ${page}`;
export const DEITIES_EMPTY_PAGE = 'Chưa có deity ở trang này. Dùng /summon.';
export const DEITIES_FOOTER = '/equip kind:deity · /deity sigil · /deity ascend (prestige)';

// --- Dòng render từng vật phẩm trong list (InventoryRepository) ---
export const WEAPON_LIST_LINE = (
	name: string,
	tier: string,
	enhancement: number,
	id: string,
	atk: number,
	crit: number,
	native: string,
	opposite: string,
): string =>
	`**${name}** (${tier}) +${enhancement}\nID: \`${id}\` · ATK ${atk} · CRIT ${crit}%\nSockets: ${native} / ${opposite}`;
export const ARMOR_LIST_LINE = (
	name: string,
	tier: string,
	enhancement: number,
	id: string,
	hp: number,
	def: number,
	native: string,
	opposite: string,
): string =>
	`**${name}** (${tier}) +${enhancement}\nID: \`${id}\` · HP ${hp} · DEF ${def}\nSockets: ${native} / ${opposite}`;
export const RUNE_LIST_LINE = (
	name: string,
	tier: string,
	lane: string,
	uid: string,
	description: string,
	socketedInto: string,
): string => `**${name}** (${tier}, ${lane})\nID: \`${uid}\` · ${description}\nGắn vào: ${socketedInto}`;
export const DEITY_LIST_LINE = (
	name: string,
	tier: string,
	userDeityId: number,
	sigils: number,
	ascended: boolean,
	atk: number,
	hp: number,
	def: number,
): string =>
	`**${name}** (${tier}) · ID: \`${userDeityId}\`\nSigil ${sigils}/10 · Ascended: ${ascended ? 'Có (prestige)' : 'Chưa'}\nATK ${atk} · HP ${hp} · DEF ${def}`;
export const DEITY_ASCENDED_YES = 'Có (prestige)';
export const DEITY_ASCENDED_NO = 'Chưa';
export const RUNE_NOT_SOCKETED = 'chưa gắn';
