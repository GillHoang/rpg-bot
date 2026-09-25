import { describe, expect, it } from 'vitest';
import * as schema from '../src/db/schema.js';

/**
 * Schema coverage guard (battle-upgrade-plan.md §Trục F / Phase 0).
 *
 * Luật chống dead flow: **mọi bảng trong schema phải được phân loại** là
 * `active` (có đường ghi + đọc trong gameplay), `planned` (đã có kế hoạch
 * kích hoạt — trỏ tới phase trong battle-upgrade-plan) hoặc `drop` (chủ động
 * nằm im, không có faucet/sink). Thêm bảng mới mà chưa phân loại sẽ làm test
 * này fail — không còn tái diễn dead flow âm thầm.
 *
 * Test này KHÔNG truy vấn DB — nó đối chiếu tập bảng export từ schema barrel
 * với manifest phân loại. Nội dung "planned"/"drop" phải khớp battle-upgrade-plan.
 */

type Coverage = 'active' | 'planned' | 'drop';

interface Entry {
	coverage: Coverage;
	/** Ghi chú: planned → phase nào; drop → lý do nằm im. */
	note: string;
}

/**
 * Manifest phân loại (khóa theo TÊN BẢNG SQL). `active` = có đường ghi + đọc
 * trong module hiện tại. `planned` = có kế hoạch trong docs/battle-upgrade-plan.md
 * (trỏ phase). `drop` = chủ động nằm im (không faucet không sink, có chủ đích).
 */
const TABLE_COVERAGE: Record<string, Entry> = {
	// ── identity ──
	users: { coverage: 'active', note: 'đăng ký/đăng nhập, mọi transaction' },
	user_character: { coverage: 'active', note: 'stat/level/pvp/gate progress' },
	users_bag: { coverage: 'active', note: 'currency + chest + essence' },
	user_presets: { coverage: 'active', note: 'loadout preset 1/2' },
	user_guild_activity: { coverage: 'planned', note: 'Trục E — Guild War' },

	// ── economy ──
	game_logs: { coverage: 'active', note: 'ledger casino/loot (chỉ creux ở 1 số đường)' },

	// ── pve ──
	mob_roster: { coverage: 'active', note: 'seed mob' },
	raid_logs: { coverage: 'active', note: 'mọi trận hunt/boss' },
	hunt_cooldowns: { coverage: 'active', note: 'cooldown hunt/boss' },
	raid_reward_daily_totals: { coverage: 'active', note: 'trần thưởng ngày' },
	raid_reward_grants: { coverage: 'planned', note: 'Trục F — per-level reward grants' },
	active_battles: { coverage: 'planned', note: 'Trục B — state trận chiến nhiều hiệp/skill' },
	boss_spawn_queue: { coverage: 'planned', note: 'Trục E — World Boss guild' },
	boss_state: { coverage: 'planned', note: 'Trục E — World Boss guild' },
	boss_attack_log: { coverage: 'planned', note: 'Trục E — World Boss guild' },
	auto_raids: { coverage: 'planned', note: 'Trục E — World Boss guild (auto)' },

	// ── pvp ──
	active_duels: { coverage: 'active', note: 'duel pending' },
	active_duel_participants: { coverage: 'active', note: 'ghim slot duel' },
	active_ranked_fights: { coverage: 'active', note: 'fight lock ranked' },
	pvp_logs: { coverage: 'active', note: 'duel/ranked settlement' },
	ranked_logs: { coverage: 'active', note: 'ranked log (isInitiator)' },
	ranked_reward: { coverage: 'active', note: 'bảng thưởng tuần (season_end_payload → planned)' },
	wager_logs: { coverage: 'active', note: 'duel có stake' },
	pvp_shop_purchases: { coverage: 'active', note: 'quota mua theo season' },

	// ── progression ──
	weapon_roster: { coverage: 'active', note: 'seed weapon' },
	armor_roster: { coverage: 'active', note: 'seed armor' },
	deity_roster: { coverage: 'active', note: 'seed deity + blessing' },
	rune_roster: { coverage: 'active', note: 'seed rune' },
	user_weapons: { coverage: 'active', note: 'kho vũ khí + quality' },
	user_armors: { coverage: 'active', note: 'kho giáp' },
	user_deities: { coverage: 'active', note: 'kho deity + sigil/ascend' },
	user_runes: { coverage: 'active', note: 'kho rune + socket' },
	essence_bag_def: { coverage: 'active', note: 'định nghĩa túi rune' },
	socket_unlock_cost: { coverage: 'active', note: 'chi phí mở socket' },
	essence_exchange_submissions: { coverage: 'planned', note: 'Trục F — essence exchange shop' },
	summon_reward_grants: { coverage: 'active', note: 'log relic pull' },
	pity_counters: { coverage: 'active', note: 'pity gacha' },

	// ── meta ──
	daily_quests: { coverage: 'active', note: 'quest ngày' },
	weekly_quests: { coverage: 'active', note: 'quest tuần' },
	daily_quest_completion_rewards: { coverage: 'active', note: 'thưởng đủ 3 daily' },
	weekly_grand: { coverage: 'active', note: 'Weekly Grand' },
	seasons: { coverage: 'active', note: 'season lazy-create + rollover' },
	cosmetic_catalog: { coverage: 'active', note: 'cosmetic' },
	title_catalog: { coverage: 'active', note: 'title' },
	user_cosmetics: { coverage: 'active', note: 'sở hữu cosmetic' },
	user_titles: { coverage: 'active', note: 'sở hữu title' },
	equipped_skins: { coverage: 'planned', note: 'Trục C — battle skin/equip cosmetic trong combat' },

	// ── casino ──
	active_casino_sessions: { coverage: 'active', note: 'phiên blackjack/crash' },
	casino_logs: { coverage: 'active', note: 'log casino' },

	// ── menu ──
	menu_action_receipts: { coverage: 'active', note: 'chống xử lý lại action' },

	// ── system ──
	server_config: { coverage: 'planned', note: 'Trục D — cấu hình runtime (gate modifier/weekly)' },
	dev_logs: { coverage: 'active', note: 'audit /reset + ghi chẩn đoán' },
	topgg_vote_events: { coverage: 'drop', note: 'bỏ vote reward (không chạy webhook HTTP)' },
	stripe_events: { coverage: 'drop', note: 'hệ supporter/stripe ngoài phạm vi' },
	supporters: { coverage: 'drop', note: 'hệ supporter ngoài phạm vi' },
	supporter_grants: { coverage: 'drop', note: 'hệ supporter ngoài phạm vi' },
	supporter_item_grants: { coverage: 'drop', note: 'hệ supporter ngoài phạm vi' },
	supporter_token_ledger: { coverage: 'drop', note: 'hệ supporter ngoài phạm vi' },
	tickets: { coverage: 'drop', note: 'hệ ticket supporter ngoài phạm vi' },
};

/** Lấy tên bảng từ drizzle table object (symbol ổn định của drizzle-orm). */
function tableName(value: unknown): string | undefined {
	if (typeof value !== 'object' || value === null) return undefined;
	const name = (value as Record<symbol, unknown>)[Symbol.for('drizzle:Name')];
	return typeof name === 'string' ? name : undefined;
}

function schemaTableNames(): string[] {
	return Object.values(schema)
		.map(tableName)
		.filter((name): name is string => name !== undefined)
		.sort();
}

describe('schema coverage (chống dead flow)', () => {
	it('phân loại mọi bảng trong schema — thêm bảng mới phải khai báo coverage', () => {
		const exported = schemaTableNames();
		const classified = Object.keys(TABLE_COVERAGE).sort();
		const unclassified = exported.filter((name) => !(name in TABLE_COVERAGE));
		const phantom = classified.filter((name) => !exported.includes(name));

		expect(unclassified, 'bảng mới chưa phân loại active/planned/drop').toEqual([]);
		expect(phantom, 'manifest liệt kê bảng không tồn tại trong schema').toEqual([]);
		expect(exported.length).toBeGreaterThan(0);
	});

	it('mọi bảng đều được đánh dấu active, planned hoặc drop có lý do', () => {
		for (const [name, entry] of Object.entries(TABLE_COVERAGE)) {
			expect(['active', 'planned', 'drop'], name).toContain(entry.coverage);
			expect(entry.note.trim().length, `${name} thiếu ghi chú`).toBeGreaterThan(0);
			if (entry.coverage === 'planned') {
				expect(entry.note, `${name} planned phải trỏ phase trong battle-upgrade-plan`).toMatch(/Trục [A-G]|Phase \d/);
			}
			if (entry.coverage === 'drop') {
				expect(entry.note.toLowerCase(), `${name} drop phải ghi lý do`).toMatch(/ngoài phạm vi|bỏ|nằm im|không/);
			}
		}
	});

	it('không có bảng nào bị bỏ quên ngoài 3 trạng thái', () => {
		const active = Object.values(TABLE_COVERAGE).filter((e) => e.coverage === 'active').length;
		const planned = Object.values(TABLE_COVERAGE).filter((e) => e.coverage === 'planned').length;
		const dropped = Object.values(TABLE_COVERAGE).filter((e) => e.coverage === 'drop').length;
		expect(active + planned + dropped).toBe(Object.keys(TABLE_COVERAGE).length);
		// Sanity: phần lớn là active — nếu "active" trống rỗng thì manifest sai.
		expect(active).toBeGreaterThan(planned);
	});
});
