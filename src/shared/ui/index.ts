/**
 * Presentation helpers shared by commands, menu panels and pagers.
 * Wording/icons stay in `src/shared/ui/text/`; canvas/pagination stay in `src/render/` —
 * this barrel is the single import path for new presentation code.
 */
export { formatNumber } from './text/format.js';
export { ICONS } from './text/icons.js';
export { buildBattleLogPage } from './render/BattleLogPager.js';
export type { BattleLogPagerOptions } from './render/BattleLogPager.js';
export { INVENTORY_CATEGORIES, isInventoryCategory, parseInventoryAction } from './render/InventoryPager.js';
export type { InventoryCategory, InventoryView } from './render/InventoryPager.js';
