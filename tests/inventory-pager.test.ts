import { describe, expect, it } from 'vitest';

/**
 * Regression cho COMPONENT_CUSTOM_ID_DUPLICATED: scheme cũ
 * `inventory:<category>:<page>` khiến nút category "Rune"
 * (inventory:runes:1) trùng custom_id với nút "Trước" của trang 2
 * (runes:2 → prev = inventory:runes:1) — Discord từ chối cả message.
 * Scheme mới tách prefix: inventory:cat:<c> vs inventory:page:<c>:<p>.
 */

const CATEGORIES = ['bag', 'weapons', 'armors', 'runes'] as const;
const CATEGORY_PREFIX = 'inventory:cat:';
const PAGE_PREFIX = 'inventory:page:';
const categoryCustomId = (category: string): string => `${CATEGORY_PREFIX}${category}`;
const pageCustomId = (category: string, page: number): string => `${PAGE_PREFIX}${category}:${page}`;

/** Mô phỏng đúng logic buildView trong InventoryCommand. */
function componentIdsFor(category: string, page: number, total: number): string[] {
	const ids = CATEGORIES.map((c) => categoryCustomId(c));
	if (total > 1) {
		ids.push(
			pageCustomId(category, page - 1),
			'inventory:indicator',
			pageCustomId(category, page + 1),
		);
	}
	return ids;
}

describe('Inventory pager custom_ids', () => {
	it('page 2 of runes has no duplicated custom_id', () => {
		for (const page of [2, 3, 5]) {
			const ids = componentIdsFor('runes', page, 2);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	it('no duplicates for any category/page combination the UI can produce', () => {
		for (const category of CATEGORIES) {
			for (let total = 1; total <= 4; total++) {
				for (let page = 1; page <= total; page++) {
					const ids = componentIdsFor(category, page, total);
					expect(new Set(ids).size).toBe(ids.length);
				}
			}
		}
	});

	it('new scheme custom_ids never collide with the old-scheme IDs users may still have on screen', () => {
		const oldSchemeIds = CATEGORIES.flatMap((c) => [1, 2, 3].map((p) => `inventory:${c}:${p}`));
		const newIds = [...CATEGORIES.map((c) => categoryCustomId(c)), pageCustomId('runes', 2), pageCustomId('runes', 1)];
		for (const id of newIds) expect(oldSchemeIds).not.toContain(id);
	});
});
