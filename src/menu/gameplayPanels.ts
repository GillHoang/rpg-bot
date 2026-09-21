import { escapeMarkdown } from 'discord.js';
import { CLASSES } from '../config/classes.js';
import { BOSS_ENTRY } from '../config/raidLoot.js';
import { GRANT_BELIEF_SHARDS, GRANT_SILVER_CHESTS } from '../config/starter.js';
import type { QuestType } from '../config/quests.js';
import type { ProfileCardData } from '../render/ProfileCardRenderer.js';
import type { QuestSnapshot } from '../services/QuestService.js';
import { MENU_QUEST_LABELS } from '../text/menu.js';
import type { GamePanel, MenuBattle } from './MenuGameplay.js';
import type { MenuScreen, MenuSession } from './MenuSessionStore.js';
import type { MenuAction } from './menuIds.js';

const n = (value: number) => value.toLocaleString('vi-VN');
function expBar(value: number, total: number): string {
	const filled = Math.min(10, Math.max(0, Math.floor((value / Math.max(1, total)) * 10)));
	return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
}
const button = (action: MenuAction, label: string, disabled = false): GamePanel['buttons'][number] => ({
	action,
	label,
	disabled,
});
const cancel = button('cancel', 'Huỷ');

function activityButtons(dailyDone: boolean) {
	return {
		dailyButton: button('daily', dailyDone ? 'Đã nhận daily' : 'Nhận daily', dailyDone),
		hunt: button('hunt', 'Săn quái'),
		quests: button('quests', 'Nhiệm vụ'),
	};
}

export function confirmationPanel(screen: Extract<MenuScreen, { kind: 'confirm' }>): GamePanel {
	if (screen.operation === 'start') {
		const c = CLASSES[screen.combatClass];
		return {
			title: `Chọn ${screen.combatClass}`,
			body:
				`${c.flavor}\n${c.passiveLine}\n\n` +
				`Chỉ số cơ bản: HP ${c.base.hp} · ATK ${c.base.atk} · DEF ${c.base.def} · Crit ${c.base.crit}%\n` +
				`Quà khởi đầu: trang bị, ${n(GRANT_BELIEF_SHARDS)} shards và ${GRANT_SILVER_CHESTS} Silver Chest.\nXác nhận để tạo nhân vật; đổi class về sau cần vật phẩm.`,
			buttons: [button('confirm', 'Tạo nhân vật'), cancel],
			classes: true,
		};
	}
	return {
		title: screen.operation === 'boss' ? 'Xác nhận đánh boss' : 'Xác nhận đổi quest',
		body:
			screen.operation === 'boss'
				? `Yêu cầu cấp ${BOSS_ENTRY.minLevel}. Phí: **${n(BOSS_ENTRY.credux)} Credux**, trừ khi vào trận kể cả thua.\nMỗi ngày 1 lượt; reset 00:00 Manila (23:00 Việt Nam).\nLượt ngày ${screen.day}.`
				: `Đổi miễn phí 1 lần/ngày. **Tiến độ của nhiệm vụ ngày chưa hoàn thành sẽ mất.** Nhiệm vụ đã hoàn thành được giữ.\nBộ nhiệm vụ ngày ${screen.day}.`,
		buttons: [{ action: 'confirm', label: 'Xác nhận', danger: true }, cancel],
	};
}

export function onboardingPanel(): GamePanel {
	return {
		title: 'Bắt đầu hành trình',
		body: 'Chọn một class bên dưới để xem chỉ số và tạo nhân vật. Sau đó bạn có thể nhận daily và săn quái ngay trong menu này.',
		classes: true,
		buttons: [],
	};
}

export function questsPanel(q: QuestSnapshot, dailyDone: boolean): GamePanel {
	const { dailyButton, hunt } = activityButtons(dailyDone);
	const rows = (weekly: boolean) =>
		(weekly ? q.weeklies : q.dailies)
			.map((row) => {
				const label = MENU_QUEST_LABELS[row.questType as QuestType];
				const bonus = 'rewardValor' in row ? `${row.rewardValor} Valor` : `${row.rewardBeliefShards} shards`;
				return `${row.completed ? '✅' : `${row.currentCount}/${row.targetCount}`} ${label} · ${n(row.rewardCredux)} Credux + ${bonus}`;
			})
			.join('\n');
	return {
		title: 'Daily & nhiệm vụ',
		body:
			`**Ngày ${q.day}**\n${rows(false)}\n\n**Tuần ${q.week}**\n${rows(true)}\n\n` +
			(q.grandClaimed
				? 'Đã nhận thưởng tuần.'
				: q.grandReady
					? 'Thưởng tuần sẵn sàng!'
					: 'Hoàn thành 3 nhiệm vụ tuần để nhận thưởng tuần.') +
			'\nThưởng từng quest tự nhận khi hoàn thành. Các tính năng kho đồ, triệu hồi và PvP sẽ được nối menu ở giai đoạn tiếp theo.',
		buttons: [
			dailyButton,
			hunt,
			button('claim', 'Nhận thưởng tuần', !q.grandReady),
			button('reroll', 'Đổi quest ngày', !q.refreshAvailable || q.dailies.every((x) => x.completed)),
		],
	};
}

export function battleLobbyPanel(p: ProfileCardData, bossDone: boolean, hasBattle: boolean): GamePanel {
	const hunt = button('hunt', 'Săn quái');
	const quests = button('quests', 'Nhiệm vụ');
	return {
		title: 'Săn quái & boss',
		body:
			`Cấp ${p.level} · ${n(p.credux)} Credux\nSăn quái miễn phí.\n` +
			`Boss: cấp ${BOSS_ENTRY.minLevel}, phí ${n(BOSS_ENTRY.credux)} Credux, 1 lượt/ngày.\n` +
			(bossDone
				? 'Đã đánh boss hôm nay.'
				: p.level < BOSS_ENTRY.minLevel
					? 'Chưa đủ cấp đánh boss.'
					: p.credux < BOSS_ENTRY.credux
						? 'Chưa đủ Credux vào boss.'
						: 'Bạn có thể đánh boss.') +
			'\nReset 00:00 Manila (23:00 Việt Nam).',
		buttons: [
			hunt,
			button('boss', 'Đánh boss', bossDone || p.level < BOSS_ENTRY.minLevel || p.credux < BOSS_ENTRY.credux),
			quests,
			...(hasBattle ? [button('result', 'Trận gần nhất')] : []),
		],
	};
}

function profileSummary(p: ProfileCardData): string {
	return (
		`**${escapeMarkdown(p.username)}**\n${CLASSES[p.combatClass].emoji} **${p.combatClass} · Cấp ${p.level}**\n` +
		`EXP ${expBar(p.exp, p.expToNext)} \`${n(p.exp)}/${n(p.expToNext)}\`\n` +
		`💰 **${n(p.credux)}** Credux · 💎 **${n(p.beliefShards)}** shards\n`
	);
}

export function profilePanel(p: ProfileCardData, dailyDone: boolean): GamePanel {
	const summary = profileSummary(p);
	const { dailyButton, hunt, quests } = activityButtons(dailyDone);
	return {
		title: 'Nhân vật',
		withAvatar: true,
		body:
			summary +
			`\nHP ${n(p.stats.hp)} · ATK ${n(p.stats.atk)} · DEF ${n(p.stats.def)} · Crit ${p.stats.crit.toFixed(1)}%\n` +
			`Tín đồ cấp ${p.believerLevel ?? 1} · EXP ${n(p.believerExp ?? 0)} · PvP ${p.pvpRating ?? 0}\n${p.title ? escapeMarkdown(p.title) : 'Chưa trang bị danh hiệu.'}`,
		buttons: [dailyButton, hunt, quests],
	};
}

export function homePanel(
	p: ProfileCardData,
	status: { dailyDone: boolean; bossDone: boolean; overallStreak: number },
	q: QuestSnapshot | null,
): GamePanel {
	const { dailyDone, bossDone, overallStreak } = status;
	const summary = profileSummary(p);
	const { dailyButton, hunt, quests } = activityButtons(dailyDone);
	return {
		title: 'Trang chủ',
		withAvatar: true,
		grouped: true,
		body:
			summary +
			`\nDaily: ${dailyDone ? 'đã nhận' : 'sẵn sàng'} · Chuỗi ${overallStreak} ngày\n` +
			`Quest hoàn thành: ngày ${q?.dailies.filter((x) => x.completed).length ?? 0}/${q?.dailies.length ?? 0} · tuần ${q?.weeklies.filter((x) => x.completed).length ?? 0}/${q?.weeklies.length ?? 0}\n` +
			(q?.grandReady ? 'Thưởng tuần sẵn sàng trong Nhiệm vụ!\n' : '') +
			`Boss: ${bossDone ? 'đã đánh hôm nay' : p.level < BOSS_ENTRY.minLevel ? `mở ở cấp ${BOSS_ENTRY.minLevel}` : 'còn lượt hôm nay'}\nReset 00:00 Manila (23:00 Việt Nam).`,
		buttons: [
			...[button('profile', 'Nhân vật'), button('help', 'Hướng dẫn'), button('search', 'Tìm hướng dẫn')].map(
				(b) => ({ ...b, group: 'Thông tin' }),
			),
			...[
				dailyButton,
				hunt,
				button('boss', 'Đánh boss', bossDone || p.level < BOSS_ENTRY.minLevel || p.credux < BOSS_ENTRY.credux),
				quests,
			].map((b) => ({ ...b, group: 'Hoạt động' })),
			...[
				button('inventory', 'Kho đồ'),
				button('deity', 'Deity & triệu hồi'),
				button('shop', 'Cửa hàng'),
				button('casino', 'Casino'),
			].map((b) => ({ ...b, group: 'Tài sản' })),
		],
	};
}

/** Split long rounds instead of silently dropping combat events at the text limit. */
export function logPages(result: MenuBattle): string[] {
	return result.battle.roundLogs.flatMap((round) => {
		const text = `Hiệp ${round.round}\nBạn: ${round.playerHp}/${round.playerMaxHp} HP · Địch: ${round.enemyHp}/${round.enemyMaxHp} HP\n${round.lines.join('\n')}`;
		const pages: string[] = [];
		let page = '';
		for (const character of text) {
			if (page.length + character.length > 2800) {
				pages.push(page);
				page = '';
			}
			page += character;
		}
		if (page) pages.push(page);
		return pages;
	});
}

export function battlePanel(session: Pick<MenuSession, 'battle' | 'screen'>): GamePanel {
	const r = session.battle;
	if (!r)
		return {
			title: 'Chiến đấu',
			body: 'Chưa có trận đấu trong menu này.',
			buttons: [button('hunt', 'Săn quái')],
		};
	if (session.screen.kind === 'log') {
		const pages = logPages(r);
		const page = Math.max(0, Math.min(pages.length - 1, session.screen.page));
		return {
			title: `Nhật ký · ${page + 1}/${Math.max(1, pages.length)}`,
			body: pages[page] ?? 'Không có log.',
			buttons: [
				button('prev', 'Trang trước', page === 0),
				button('next', 'Trang sau', page >= pages.length - 1),
				button('result', 'Kết quả'),
			],
		};
	}
	return {
		title: 'Kết quả trận đấu',
		body:
			`${r.battle.outcome === 'player_win' ? 'Chiến thắng' : r.battle.outcome === 'enemy_win' ? 'Thất bại' : 'Hoà'} · ${escapeMarkdown(r.monsterName)}\n` +
			`${r.battle.rounds} hiệp · HP còn ${r.battle.playerHpRemaining}\n+${n(r.expGained)} EXP · +${n(r.credux)} Credux · +${n(r.shards)} shards\n` +
			(r.gotChest ? `+1 ${r.chestName}\n` : '') +
			(r.gearDrop ? `${r.gearDrop}\n` : '') +
			(r.progress.leveledUp ? `Lên cấp ${r.progress.previousLevel} → ${r.progress.newLevel}!\n` : '') +
			(r.boss ? `Phí vào boss: −${n(BOSS_ENTRY.credux)} Credux.\n` : ''),
		buttons: [button('log', 'Xem nhật ký'), button('hunt', 'Săn tiếp'), button('quests', 'Nhiệm vụ')],
	};
}
