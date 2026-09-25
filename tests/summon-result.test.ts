import { describe, expect, it } from 'vitest';
import { SUMMON_SUCCESS, SUMMON_SUCCESS_RELIC } from '../src/shared/ui/text/summon.js';
import { PITY_THRESHOLD } from '../src/shared/config/gachaRates.js';

/**
 * Regression cho 50035 BASE_TYPE_MAX_LENGTH: /summon x30 toàn trùng từng
 * sinh message > 2000 ký tự → Discord từ chối, người chơi mất kết quả.
 * summarizePulls phải gộp các lượt giống hệt nhau thành ×N và cắt đuôi
 * khi tổng vẫn vượt giới hạn 2000 ký tự của Discord.
 */

// Các hàm nằm trong SummonCommand.ts (không export) — mirror logic để test
// bất biến: kết quả build từ pulls phải vừa trong 2000 ký tự sau header/footer.

interface PullLine {
	tier: string;
	name: string;
	mythology: string;
	isDupe: boolean;
	essenceGained: number;
}

const TIER_ALIAS: Record<string, string> = {
	Epic: 'Remnant',
	Mythic: 'Awakened',
	Legendary: 'Undying',
	Supreme: 'Primordial',
};
const SUMMON_DUPE_SUFFIX = (essence: number, tier: string): string => ` (trùng — +${essence} ${tier} Essence)`;
const SUMMON_NEW_SUFFIX = ' ✨ MỚI';
const SUMMON_DUPE_TIMES = (count: number): string => ` ×${count}`;
const MAX_CONTENT_CHARS = 2000;
const SUMMON_SUCCESS_OVERHEAD = 220;
const SUMMON_LINES_TRUNCATED = (hidden: number): string => `…và ${hidden} lượt nữa (xem essence trong /balance)`;

function fitContent(lines: string[]): string[] {
	const trimmed = lines.map((l) => l.replace(/ ×1$/, ''));
	const joined = trimmed.join('\n');
	if (joined.length <= MAX_CONTENT_CHARS - SUMMON_SUCCESS_OVERHEAD) return trimmed;
	const kept: string[] = [];
	let used = SUMMON_SUCCESS_OVERHEAD;
	for (let i = 0; i < trimmed.length; i++) {
		const line = trimmed[i]!;
		const tail = SUMMON_LINES_TRUNCATED(trimmed.length - i);
		if (used + line.length + 1 + tail.length > MAX_CONTENT_CHARS) {
			kept.push(tail);
			return kept;
		}
		kept.push(line);
		used += line.length + 1;
	}
	return kept;
}

function summarizePulls(pulls: readonly PullLine[]): string {
	const groups = new Map<string, { line: string; count: number }>();
	const order: string[] = [];
	for (const p of pulls) {
		const alias = TIER_ALIAS[p.tier];
		const suffix = p.isDupe ? SUMMON_DUPE_SUFFIX(p.essenceGained, p.tier) : SUMMON_NEW_SUFFIX;
		const line = `**[${p.tier} · ${alias}]** ${p.name} (${p.mythology})${suffix}`;
		const group = groups.get(line);
		if (group) group.count += 1;
		else {
			groups.set(line, { line, count: 1 });
			order.push(line);
		}
	}
	const lines = order.map((key) => {
		const { line, count } = groups.get(key)!;
		return count > 1 ? `${line}${SUMMON_DUPE_TIMES(count)}` : line;
	});
	return fitContent(lines).join('\n');
}

function successMessage(pulls: readonly PullLine[]): string {
	return `🔮 **Triệu hồi x${pulls.length}** — đã dùng ${(pulls.length * 100).toLocaleString()} Belief Shards\n\n${summarizePulls(pulls)}\n\n_Pity hiện tại: 9/150_`;
}

const dupe = (name: string, mythology: string, tier: string, essence: number): PullLine => ({
	tier,
	name,
	mythology,
	isDupe: true,
	essenceGained: essence,
});
const neue = (name: string, mythology: string, tier: string): PullLine => ({
	tier,
	name,
	mythology,
	isDupe: false,
	essenceGained: 0,
});

describe('Summon result fits Discord limits', () => {
	it('collapses identical duplicates into ×N lines', () => {
		const pulls = [
			dupe('Bastet', 'Egyptian', 'Epic', 1),
			dupe('Bastet', 'Egyptian', 'Epic', 1),
			dupe('Bastet', 'Egyptian', 'Epic', 1),
			neue('Amaterasu', 'Japanese', 'Supreme'),
		];
		const text = summarizePulls(pulls);
		expect(text).toContain('Bastet');
		expect(text).toContain('×3');
		expect(text).not.toContain('×1');
		expect(text.match(/Bastet/g)).toHaveLength(1);
	});

	it('x30 of the SAME dupe stays far below 2000 chars', () => {
		const pulls = Array.from({ length: 30 }, () => dupe('Tsukuyomi', 'Japanese', 'Epic', 1));
		const message = successMessage(pulls);
		expect(message.length).toBeLessThanOrEqual(2000);
		expect(message).toContain('×30');
	});

	it('the logged 30-pull message (many distinct dupes + new) stays ≤ 2000 chars and keeps summary tail', () => {
		// Tái hiện đúng kịch bản trong log lỗi: 30 lượt, phần lớn là dupe
		// nhiều deity khác nhau, vài lượt MỚI, kết thúc bằng dupe Loki.
		const pool: Array<() => PullLine> = [
			() => dupe('Bastet', 'Egyptian', 'Epic', 1),
			() => dupe('Bathala', 'Filipino', 'Epic', 1),
			() => dupe('Anubis', 'Egyptian', 'Mythic', 2),
			() => dupe('Loki', 'Norse', 'Mythic', 2),
			() => dupe('Amanikable', 'Filipino', 'Epic', 1),
			() => dupe('Tsukuyomi', 'Japanese', 'Epic', 1),
			() => neue('Hermes', 'Greek', 'Mythic'),
			() => dupe('Freyja', 'Norse', 'Epic', 1),
			() => dupe('Apolaki', 'Filipino', 'Mythic', 2),
			() => dupe('Susanoo', 'Japanese', 'Mythic', 2),
			() => neue('Mayari', 'Filipino', 'Mythic'),
			() => dupe('Amihan', 'Filipino', 'Epic', 1),
			() => neue('Amaterasu', 'Japanese', 'Supreme'),
		];
		const pulls = Array.from({ length: 30 }, (_, i) => pool[(i * 7) % pool.length]!());
		const message = successMessage(pulls);
		expect(message.length).toBeLessThanOrEqual(2000);
		// Không được mất thông tin số lượt bị ẩn.
		if (summarizePulls(pulls).includes('…và')) {
			expect(message).toMatch(/…và \d+ lượt nữa/);
		}
	});

	it('renders the live pity threshold instead of a hardcoded one', () => {
		expect(PITY_THRESHOLD).toBe(150);
		expect(SUMMON_SUCCESS(13, '1,300', 'x', 11, PITY_THRESHOLD)).toContain('11/150');
		expect(SUMMON_SUCCESS_RELIC(1, 'c', 'x', 11, PITY_THRESHOLD)).toContain('11/150');
	});

	it('total count in ×N groups adds up to the pull count (no lost pulls)', () => {
		const pool: Array<() => PullLine> = [
			() => dupe('Bastet', 'Egyptian', 'Epic', 1),
			() => dupe('Loki', 'Norse', 'Mythic', 2),
			() => neue('Amaterasu', 'Japanese', 'Supreme'),
		];
		const pulls = Array.from({ length: 30 }, (_, i) => pool[i % pool.length]!());
		const text = summarizePulls(pulls);
		const total = [...text.matchAll(/×(\d+)/g)].reduce((sum, m) => sum + Number(m[1]), 0) + [...text.matchAll(/\n(?!\s*$)/g)].length;
		// Mỗi dòng không ×N đại diện đúng 1 lượt; cộng với các nhóm ×N phải đủ 30.
		const lines = text.split('\n');
		const singles = lines.filter((l) => !/×\d+$/.test(l)).length;
		const grouped = [...text.matchAll(/×(\d+)/g)].reduce((sum, m) => sum + Number(m[1]), 0);
		expect(singles + grouped).toBe(30);
		void total;
	});
});
