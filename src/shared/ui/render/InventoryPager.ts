import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import type { InventoryService } from '../../../modules/progression/application/InventoryService.js';
import {
	bagSummary,
	INVENTORY_CATEGORY_LABELS,
	INVENTORY_EMPTY_PAGE,
	INVENTORY_FOOTER,
	INVENTORY_NEXT_LABEL,
	INVENTORY_PAGE_INDICATOR,
	INVENTORY_PREV_LABEL,
	INVENTORY_TITLE,
} from '../text/inventory.js';

const PAGE_SIZE = 8; // khớp limit/offset trong InventoryService.list
export const INVENTORY_CATEGORIES = ['bag', 'weapons', 'armors', 'runes'] as const;

/**
 * Hai prefix RỜI nhau cho nút loại và nút trang. Dùng chung một scheme
 * `inventory:<category>:<page>` thì nút "Rune" (inventory:runes:1) trùng
 * custom_id với nút "Trước" khi đang ở trang 2 (inventory:runes:2-1) —
 * Discord từ chối cả message (COMPONENT_CUSTOM_ID_DUPLICATED).
 */
const CATEGORY_PREFIX = 'inventory:cat:';
const PAGE_PREFIX = 'inventory:page:';
const categoryCustomId = (category: string): string => `${CATEGORY_PREFIX}${category}`;
const pageCustomId = (category: string, page: number): string => `${PAGE_PREFIX}${category}:${page}`;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export function isInventoryCategory(value: string | null): value is InventoryCategory {
	return value !== null && (INVENTORY_CATEGORIES as readonly string[]).includes(value);
}

/** Only accept actionable, complete IDs; category changes always reset to page 1. */
export function parseInventoryAction(customId: string): { category: InventoryCategory; page: number } | null {
	const [prefix, action, category, pageRaw, ...extra] = customId.split(':');
	if (prefix !== 'inventory' || !isInventoryCategory(category) || extra.length > 0) return null;
	if (action === 'cat' && pageRaw === undefined) return { category, page: 1 };
	if (action !== 'page' || pageRaw === undefined || !/^[1-9]\d*$/.test(pageRaw)) return null;
	const page = Number(pageRaw);
	return Number.isSafeInteger(page) ? { category, page } : null;
}

export interface InventoryView {
	embed: EmbedBuilder;
	rows: ActionRowBuilder<ButtonBuilder>[];
	total: number;
	page: number;
	category: string;
}

export async function buildInventoryView(
	repo: Pick<InventoryService, 'bag' | 'count' | 'list'>,
	userId: string,
	category: InventoryCategory,
	requestedPage: number,
): Promise<InventoryView> {
	const total = category === 'bag' ? 1 : Math.max(1, Math.ceil((await repo.count(userId, category)) / PAGE_SIZE));
	const page = Math.min(Math.max(requestedPage, 1), total);
	const lines =
		category === 'bag' ? [bagSummary((await repo.bag(userId))!)] : await repo.list(userId, category, page);

	const embed = new EmbedBuilder()
		.setTitle(INVENTORY_TITLE(category, page))
		.setDescription(lines.join('\n\n').slice(0, 4000) || INVENTORY_EMPTY_PAGE)
		.setFooter({ text: INVENTORY_FOOTER });

	const rows = [
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			INVENTORY_CATEGORIES.map((c) =>
				new ButtonBuilder()
					.setCustomId(categoryCustomId(c))
					.setLabel(INVENTORY_CATEGORY_LABELS[c] ?? c)
					.setStyle(c === category ? ButtonStyle.Primary : ButtonStyle.Secondary),
			),
		),
	];
	if (total > 1) {
		rows.push(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(pageCustomId(category, page - 1))
					.setLabel(INVENTORY_PREV_LABEL)
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page <= 1),
				new ButtonBuilder()
					.setCustomId('inventory:indicator')
					.setLabel(INVENTORY_PAGE_INDICATOR(page, total))
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId(pageCustomId(category, page + 1))
					.setLabel(INVENTORY_NEXT_LABEL)
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(page >= total),
			),
		);
	}
	return { embed, rows, total, page, category };
}
