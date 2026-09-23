import { describe, expect, it } from 'vitest';
import type { GamePanel, MenuBattle } from '../src/menu/MenuGameplay.js';
import type { ProfileCardData } from '../src/render/ProfileCardRenderer.js';
import type { QuestSnapshot } from '../src/services/QuestService.js';
import {
	battleLobbyPanel,
	battlePanel,
	confirmationPanel,
	homePanel,
	logPages,
	onboardingPanel,
	profilePanel,
	questsPanel,
} from '../src/menu/gameplayPanels.js';

const profile: ProfileCardData = {
	username: '*Hero*',
	combatClass: 'Knight',
	level: 10,
	exp: 500,
	expToNext: 1000,
	stats: { hp: 1000, atk: 200, def: 300, crit: 5 },
	credux: 10000,
	beliefShards: 1000,
};
const quests: QuestSnapshot = {
	day: '2026-09-21',
	week: '2026-W39',
	refreshAvailable: true,
	grandClaimed: false,
	grandReady: false,
	dailies: [
		{
			id: 1,
			discordId: 'owner',
			questType: 'daily',
			currentCount: 0,
			targetCount: 1,
			rewardCredux: 1000,
			rewardBeliefShards: 5,
			completed: false,
			questDate: '2026-09-21',
		},
	],
	weeklies: [
		{
			id: 2,
			discordId: 'owner',
			questType: 'raid_win',
			currentCount: 10,
			targetCount: 10,
			rewardCredux: 5000,
			rewardValor: 10,
			completed: true,
			questWeek: '2026-W39',
		},
	],
};
const battle: MenuBattle = {
	status: 'ok',
	boss: true,
	monsterName: '*Boss*',
	credux: 1000,
	shards: 100,
	expGained: 2000,
	gotChest: true,
	chestName: 'Silver Chest',
	gearDrop: 'Sword',
	progress: { previousLevel: 9, newLevel: 10, leveledUp: true },
	battle: { outcome: 'player_win', rounds: 1, log: [], roundLogs: [], playerHpRemaining: 10, enemyHpRemaining: 0 },
};
const action = (panel: GamePanel, name: string) => panel.buttons.find((button) => button.action === name);

describe('pure gameplay panels', () => {
	it('keeps onboarding and class confirmation content and actions', () => {
		expect(onboardingPanel()).toEqual({
			title: 'Bắt đầu hành trình',
			body: 'Chọn một class bên dưới để xem chỉ số và tạo nhân vật. Sau đó bạn có thể nhận daily và săn quái ngay trong menu này.',
			classes: true,
			buttons: [],
		});
		const panel = confirmationPanel({ kind: 'confirm', operation: 'start', combatClass: 'Knight' });
		expect(panel.title).toBe('Chọn Knight');
		expect(panel.classes).toBe(true);
		expect(panel.body).toContain('Chỉ số cơ bản: HP 1000 · ATK 200 · DEF 300 · Crit 5%');
		expect(panel.body).toContain('Quà khởi đầu: trang bị, 1.000 shards và 10 Silver Chest.');
		expect(panel.buttons).toEqual([
			{ action: 'confirm', label: 'Tạo nhân vật', disabled: false },
			{ action: 'cancel', label: 'Huỷ', disabled: false },
		]);
	});

	it('preserves dated boss and quest confirmation warnings', () => {
		const boss = confirmationPanel({ kind: 'confirm', operation: 'boss', day: '2026-09-21' });
		expect(boss.body).toBe(
			'Yêu cầu cấp 10. Phí: **10.000 Credux**, trừ khi vào trận kể cả thua.\nMỗi ngày 1 lượt; reset 00:00 Manila (23:00 Việt Nam).\nLượt ngày 2026-09-21.',
		);
		const reroll = confirmationPanel({ kind: 'confirm', operation: 'reroll', day: '2026-09-21' });
		expect(reroll.body).toBe(
			'Đổi miễn phí 1 lần/ngày. **Tiến độ của nhiệm vụ ngày chưa hoàn thành sẽ mất.** Nhiệm vụ đã hoàn thành được giữ.\nBộ nhiệm vụ ngày 2026-09-21.',
		);
		expect(boss.buttons).toEqual(reroll.buttons);
		expect(action(boss, 'confirm')).toEqual({ action: 'confirm', label: 'Xác nhận', danger: true });
	});

	it('escapes player text, formats progress and keeps profile defaults', () => {
		const panel = profilePanel(profile);
		expect(panel.title).toBe('Nhân vật');
		expect(panel.withAvatar).toBe(true);
		expect(panel.body).toContain('**\\*Hero\\***');
		expect(panel.body).toContain('EXP <a:linee2:');
		expect(panel.body).toContain(' `500/1.000`');
		expect(panel.body).not.toMatch(/[▰▱]/);
		expect(panel.body).toContain('HP 1.000 · ATK 200 · DEF 300');
		expect(panel.body).toContain('Vũ khí: Chưa trang bị');
		expect(panel.body).toContain('Chưa có thần đồng hành');
		expect(panel.grouped).toBe(true);
		expect(panel.buttons.map((b) => b.action)).toEqual(['hunt']);
		const titled = profilePanel({
			...profile,
			title: '*Champion*',
			loadout: {
				weapon: { name: '*Sword*', enhancement: 3 },
				armor: null,
				deities: [{ name: '*Zeus*', sigils: 2 }],
			},
		});
		expect(titled.body).toContain('\\*Champion\\*');
		expect(titled.body).toContain('**\\*Sword\\*** · +2');
		expect(titled.body).toContain('**\\*Zeus\\*** · 2 Sigil');
	});

	it('keeps home groups without showing activity details', () => {
		const panel = homePanel(profile, { dailyDone: true, bossDone: true });
		expect(panel.grouped).toBe(true);
		expect(panel.withAvatar).toBe(true);
		expect(panel.body).not.toMatch(/Daily:|Quest hoàn thành:|Thưởng tuần|Boss:|Reset/);
		expect(panel.buttons.map(({ action, group }) => [action, group])).toEqual([
			['profile', 'Thông tin'],
			['help', 'Thông tin'],
			['search', 'Thông tin'],
			['daily', 'Hoạt động'],
			['hunt', 'Hoạt động'],
			['boss', 'Hoạt động'],
			['quests', 'Hoạt động'],
			['inventory', 'Tài sản'],
			['deity', 'Tài sản'],
			['shop', 'Tài sản'],
			['casino', 'Tài sản'],
		]);
		const empty = homePanel({ ...profile, level: 1 }, { dailyDone: false, bossDone: false });
		expect(empty.body).not.toMatch(/Daily:|Quest hoàn thành:|Boss:|Reset/);
		expect(action(empty, 'boss')?.disabled).toBe(true);
	});

	it('renders daily/weekly rewards and switches claim and reroll availability', () => {
		const panel = questsPanel(quests, false);
		expect(panel.body).toContain('**Ngày 2026-09-21**\n0/1 Nhận daily · 1.000 Credux + 5 shards');
		expect(panel.body).toContain('**Tuần 2026-W39**\n✅ Thắng săn quái/boss · 5.000 Credux + 10 Valor');
		expect(panel.body).toContain('Hoàn thành 3 nhiệm vụ tuần để nhận thưởng tuần.');
		expect(action(panel, 'claim')?.disabled).toBe(true);
		expect(action(panel, 'reroll')?.disabled).toBe(false);
		const ready = questsPanel({ ...quests, grandReady: true, refreshAvailable: false }, true);
		expect(ready.body).toContain('Thưởng tuần sẵn sàng!');
		expect(action(ready, 'claim')?.disabled).toBe(false);
		expect(action(ready, 'reroll')?.disabled).toBe(true);
		const completed = questsPanel(
			{ ...quests, grandClaimed: true, dailies: quests.dailies.map((row) => ({ ...row, completed: true })) },
			false,
		);
		expect(completed.body).toContain('Đã nhận thưởng tuần.');
		expect(action(completed, 'reroll')?.disabled).toBe(true);
	});

	it.each([
		{ level: 9, credux: 10000, done: false, text: 'Chưa đủ cấp đánh boss.', disabled: true },
		{ level: 10, credux: 9999, done: false, text: 'Chưa đủ Credux vào boss.', disabled: true },
		{ level: 10, credux: 10000, done: true, text: 'Đã đánh boss hôm nay.', disabled: true },
		{ level: 10, credux: 10000, done: false, text: 'Bạn có thể đánh boss.', disabled: false },
	])('preserves boss gate text and buttons: $text', ({ level, credux, done, text, disabled }) => {
		const panel = battleLobbyPanel({ ...profile, level, credux }, done, false);
		expect(panel.body).toContain(text);
		expect(action(panel, 'boss')?.disabled).toBe(disabled);
		expect(action(panel, 'result')).toBeUndefined();
		expect(action(battleLobbyPanel(profile, false, true), 'result')?.label).toBe('Trận gần nhất');
	});

	it('preserves battle outcome, rewards, optional drops and next actions', () => {
		const panel = battlePanel({ battle, screen: { kind: 'result' } });
		expect(panel.body).toBe(
			'Chiến thắng · \\*Boss\\*\n1 hiệp · HP còn 10\n+2.000 EXP · +1.000 Credux · +100 shards\n+1 Silver Chest\nSword\nLên cấp 9 → 10!\nPhí vào boss: −10.000 Credux.\n',
		);
		expect(panel.buttons.map(({ action }) => action)).toEqual(['first', 'prev', 'next', 'last']);
		for (const [outcome, label] of [
			['enemy_win', 'Thất bại'],
			['draw', 'Hoà'],
		] as const) {
			const result = battlePanel({
				battle: {
					...battle,
					boss: false,
					gotChest: false,
					gearDrop: null,
					progress: { previousLevel: 10, newLevel: 10, leveledUp: false },
					battle: { ...battle.battle, outcome },
				},
				screen: { kind: 'result' },
			});
			expect(result.body).toBe(
				`${label} · \\*Boss\\*\n1 hiệp · HP còn 10\n+2.000 EXP · +1.000 Credux · +100 shards\n`,
			);
		}
	});

	it('preserves all log characters, clamps pages and handles empty battles', () => {
		const line = '🔥'.repeat(3000) + 'END';
		const logged = {
			...battle,
			battle: {
				...battle.battle,
				roundLogs: [{ round: 1, lines: [line], playerHp: 10, playerMaxHp: 100, enemyHp: 0, enemyMaxHp: 100 }],
			},
		};
		const pages = logPages(logged);
		expect(pages.join('')).toBe(`Hiệp 1\nBạn: 10/100 HP · Địch: 0/100 HP\n${line}`);
		expect(pages.every((page) => page.length <= 2800)).toBe(true);
		const first = battlePanel({ battle: logged, screen: { kind: 'log', page: -1 } });
		const last = battlePanel({ battle: logged, screen: { kind: 'log', page: 99 } });
		expect(first.title).toBe('Nhật ký · 1/1');
		expect(last.title).toBe('Nhật ký · 1/1');
		expect(action(first, 'prev')?.disabled).toBe(true);
		expect(action(last, 'next')?.disabled).toBe(true);
		const empty = battlePanel({ battle, screen: { kind: 'log', page: 0 } });
		expect(empty.title).toBe('Nhật ký · 1/1');
		expect(empty.body).toBe('Không có log.');
		expect(action(empty, 'prev')?.disabled).toBe(true);
		expect(action(empty, 'next')?.disabled).toBe(true);
		const missing = battlePanel({ screen: { kind: 'result' } });
		expect(missing.body).toBe('Chưa có trận đấu trong menu này.');
		expect(missing.buttons).toEqual([{ action: 'hunt', label: 'Săn quái', disabled: false }]);
	});
});
