import { formatNumber } from './format.js';
import type { usersBag } from '../../../db/schema.js';
export function bagSummary(b: typeof usersBag.$inferSelect): string {
	return (
		`Credux: **${formatNumber(b.credux)}** · Belief Shards: **${formatNumber(b.beliefShards)}**\n` +
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
export const INVENTORY_FOOTER = '/equip · /enhance · /socket · Dùng nút bên dưới để chuyển loại/trang';

// --- Nút phân trang /inventory ---
export const INVENTORY_PAGER_TTL_MS = 180_000;
export const INVENTORY_CATEGORY_LABELS: Record<string, string> = {
	bag: 'Túi',
	weapons: 'Vũ khí',
	armors: 'Giáp',
	runes: 'Rune',
};
export const INVENTORY_PREV_LABEL = 'Trước';
export const INVENTORY_NEXT_LABEL = 'Sau';
export const INVENTORY_PAGE_INDICATOR = (page: number, total: number): string => `Trang ${page}/${total}`;

export const DEITIES_DESCRIPTION = 'Xem ID, Sigil và chỉ số deity';
export const DEITIES_PAGE_OPTION_DESC = 'Trang';
export const DEITIES_TITLE = (page: number): string => `Deities · Trang ${page}`;
export const DEITIES_EMPTY_PAGE = 'Chưa có deity ở trang này. Dùng /summon.';
export const DEITIES_FOOTER = '/equip kind:deity · /deity sigil · /deity ascend (prestige)';

// --- Dòng render từng vật phẩm trong list (InventoryService) ---
export interface GearListEntry {
	name: string;
	tier: string;
	/** Cấp enhance hiện tại - 1 (hiển thị dạng +N, Common = +0). */
	plus: number;
	id: string;
	native: string;
	opposite: string;
}

export function WEAPON_LIST_LINE(e: GearListEntry & { atk: number; crit: number; quality?: string }): string {
	return (
		`**${e.name}** (${e.tier}${e.quality ? ` · ${e.quality}` : ''}) +${e.plus}
` +
		`ID: \`${e.id}\` · ATK ${e.atk} · CRIT ${e.crit}%
` +
		`Sockets: ${e.native} / ${e.opposite}`
	);
}

export function ARMOR_LIST_LINE(e: GearListEntry & { hp: number; def: number }): string {
	return (
		`**${e.name}** (${e.tier}) +${e.plus}
` +
		`ID: \`${e.id}\` · HP ${e.hp} · DEF ${e.def}
` +
		`Sockets: ${e.native} / ${e.opposite}`
	);
}

export function RUNE_LIST_LINE(e: {
	name: string;
	tier: string;
	lane: string;
	uid: string;
	description: string;
	socketedInto: string;
}): string {
	return `**${e.name}** (${e.tier}, ${e.lane})
ID: \`${e.uid}\` · ${e.description}
Gắn vào: ${e.socketedInto}`;
}

export const DEITY_ASCENDED_YES = 'Có (prestige)';
export const DEITY_ASCENDED_NO = 'Chưa';
export const RUNE_NOT_SOCKETED = 'chưa gắn';

export function DEITY_LIST_LINE(e: {
	name: string;
	tier: string;
	userDeityId: number;
	sigils: number;
	ascended: boolean;
	atk: number;
	hp: number;
	def: number;
}): string {
	return (
		`**${e.name}** (${e.tier}) · ID: \`${e.userDeityId}\`
` +
		`Sigil ${e.sigils}/10 · Ascended: ${e.ascended ? DEITY_ASCENDED_YES : DEITY_ASCENDED_NO}
` +
		`ATK ${e.atk} · HP ${e.hp} · DEF ${e.def}`
	);
}
