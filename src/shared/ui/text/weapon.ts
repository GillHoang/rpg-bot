import { ICONS } from './icons.js';
import { formatNumber } from './format.js';

export const WEAPON_DESCRIPTION = 'Xem, quay, rã và nâng phẩm vũ khí kiểu OwO';
export const WEAPON_VIEW_SUB = 'Xem chi tiết một vũ khí';
export const WEAPON_CRATE_SUB = 'Mở weapon crate: quay 1 vũ khí ngẫu nhiên';
export const WEAPON_EQUIP_SUB = 'Cho một deity cầm vũ khí (chỉ deity chủ đạo tính vào combat)';
export const WEAPON_UNEQUIP_SUB = 'Gỡ vũ khí khỏi deity đang cầm';
export const WEAPON_DEITY_OPTION = 'ID deity (tra trong /deities)';
export const WEAPON_PRESET_OPTION = 'Preset (mặc định: preset đang dùng)';
export const WEAPON_UPGRADE_SUB = 'Nâng phẩm vũ khí bằng weapon shard + credux';
export const WEAPON_DISMANTLE_SUB = 'Rã vũ khí thừa lấy weapon shard';
export const WEAPON_SELL_SUB = 'Bán vũ khí lấy credux';
export const WEAPON_ID_OPTION = 'ID vũ khí (tra trong /inventory)';
export const WEAPON_LOCKED_SUFFIX = 'đang khoá';

export const WEAPON_QUALITY_LABELS: Record<string, string> = {
	Common: 'Thường',
	Uncommon: 'Tốt',
	Rare: 'Hiếm',
	Epic: 'Sử thi',
	Mythical: 'Thần thoại',
	Legendary: 'Truyền thuyết',
	Fabled: 'Huyền thoại',
};

export const WEAPON_DETAIL_TITLE = (name: string): string => `${ICONS.gear.weapon} **${name}**`;
export const WEAPON_DETAIL_BODY = (e: {
	tier: string;
	quality: string;
	plus: number;
	id: string;
	atk: number;
	effAtk: number;
	crit: number;
	effCrit: number;
	passiveName: string;
	passiveDescription: string;
	lore: string;
	wielder: string;
	locked: string;
}): string =>
	`${e.tier} · Phẩm **${e.quality}** · +${e.plus}\n` +
	`ID: \`${e.id}\` · ATK ${e.atk} (thực chiến ${e.effAtk}) · CRIT ${e.crit}% (thực chiến ${e.effCrit}%)\n` +
	`Nội tại **${e.passiveName}**: ${e.passiveDescription}\n` +
	`_${e.lore}_\n${e.wielder}${e.locked}`;

export const WEAPON_WIELDED_BY = (deity: string): string => `Đang được **${deity}** cầm.`;
export const WEAPON_UNWIELDED = 'Chưa gắn vào deity nào — /weapon equip để cho deity cầm.';

export const WEAPON_CRATE_RESULT = (e: {
	name: string;
	tier: string;
	quality: string;
	id: string;
	atk: number;
	crit: number;
}): string =>
	`${ICONS.gear.weapon} Quay được **${e.name}** (${e.tier} · phẩm **${e.quality}**)\n` +
	`ID: \`${e.id}\` · ATK ${e.atk} · CRIT ${e.crit}%\n` +
	`/equip kind:weapon id:${e.id} để trang bị.`;

export const WEAPON_UPGRADED = (name: string, quality: string): string =>
	`${ICONS.gear.enhance} **${name}** lên phẩm **${quality}**! Chỉ số thực chiến tăng theo phẩm.`;

export const WEAPON_DISMANTLED = (name: string, shards: number, credux: string): string =>
	`${ICONS.gear.weapon} Đã rã **${name}**: +${shards} weapon shard, +${credux} credux.`;

export const WEAPON_SOLD = (name: string, credux: string): string =>
	`${ICONS.economy.wallet} Đã bán **${name}**: +${credux} credux.`;

export const WEAPON_NOT_FOUND = 'Không tìm thấy vũ khí này trong kho của bạn.';
export const WEAPON_DEITY_NOT_OWNED = 'Bạn không sở hữu deity này.';
export const WEAPON_EQUIPPED_GUARD = 'Vũ khí đang được deity sử dụng — hãy /weapon unequip trước.';
export const WEAPON_NOT_ATTACHED = 'Vũ khí này chưa gắn vào deity nào.';
export const WEAPON_ATTACHED = (weapon: string, deity: string): string =>
	`${ICONS.gear.weapon} **${deity}** đã cầm **${weapon}**. Chỉ vũ khí của deity chủ đạo (slot 1) mới tính vào combat — /preset để xem pantheon.`;
export const WEAPON_DETACHED = (weapon: string): string => `${ICONS.gear.weapon} Đã gỡ **${weapon}** khỏi deity.`;
export const WEAPON_LOCKED_GUARD = 'Vũ khí đang khoá — mở khoá trước khi rã/bán.';
export const WEAPON_MAX_QUALITY = 'Vũ khí đã đạt phẩm tối đa (Fabled).';
export const WEAPON_NO_CHARACTER = 'Bạn chưa có nhân vật. Dùng /start trước.';
export const WEAPON_INSUFFICIENT_CREDUX = (needed: string, have: string): string =>
	`Không đủ credux: cần ${needed}, hiện có ${have}.`;
export const WEAPON_INSUFFICIENT_SHARDS = (needed: number, have: number): string =>
	`Không đủ weapon shard: cần ${needed}, hiện có ${have}. Rã vũ khí thừa để kiếm thêm.`;
export const WEAPON_CRATE_COST_LINE = (cost: number): string =>
	`Weapon crate giá ${formatNumber(cost)} credux / lần quay.`;
