import { enhancementPlus } from '../utils/enhancementDisplay.js';
import { escapeMarkdown } from 'discord.js';
import { CLASSES } from '../config/classes.js';
import { BOSS_ENTRY } from '../config/raidLoot.js';
import { GRANT_BELIEF_SHARDS, GRANT_SILVER_CHESTS } from '../config/starter.js';
import type { QuestType } from '../config/quests.js';
import type { ProfileSummaryData } from '../services/ProfileService.js';
import type { ProfileCardData } from '../render/ProfileCardRenderer.js';
import type { QuestSnapshot } from '../services/QuestService.js';
import { MENU_QUEST_LABELS } from '../text/menu.js';
import { renderProgressBar } from '../utils/progressBar.js';
import type { GamePanel, MenuBattle } from './MenuGameplay.js';
import type { MenuScreen, MenuSession } from './MenuSessionStore.js';
import type { MenuAction } from './menuIds.js';

const n = (value: number) => value.toLocaleString('vi-VN');
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
				const progress = row.completed ? '✅' : `${row.currentCount}/${row.targetCount}`;
				return `${progress} ${label} · ${n(row.rewardCredux)} Credux + ${bonus}`;
			})
			.join('\n');
	let grandStatus = 'Hoàn thành 3 nhiệm vụ tuần để nhận thưởng tuần.';
	if (q.grandClaimed) grandStatus = 'Đã nhận thưởng tuần.';
	else if (q.grandReady) grandStatus = 'Thưởng tuần sẵn sàng!';
	return {
		title: 'Daily & nhiệm vụ',
		body:
			`**Ngày ${q.day}**\n${rows(false)}\n\n**Tuần ${q.week}**\n${rows(true)}\n\n` +
			grandStatus +
			'\nThưởng từng quest tự nhận khi hoàn thành. Các tính năng kho đồ, triệu hồi và PvP sẽ được nối menu ở giai đoạn tiếp theo.',
		buttons: [
			dailyButton,
			hunt,
			button('claim', 'Nhận thưởng tuần', !q.grandReady),
			button('reroll', 'Đổi quest ngày', !q.refreshAvailable || q.dailies.every((x) => x.completed)),
		],
	};
}

export function battleLobbyPanel(p: ProfileSummaryData, bossDone: boolean, hasBattle: boolean): GamePanel {
	const hunt = button('hunt', 'Săn quái');
	const quests = button('quests', 'Nhiệm vụ');
	let bossStatus = 'Bạn có thể đánh boss.';
	if (bossDone) bossStatus = 'Đã đánh boss hôm nay.';
	else if (p.level < BOSS_ENTRY.minLevel) bossStatus = 'Chưa đủ cấp đánh boss.';
	else if (p.credux < BOSS_ENTRY.credux) bossStatus = 'Chưa đủ Credux vào boss.';
	return {
		title: 'Săn quái & boss',
		body:
			`Cấp ${p.level} · ${n(p.credux)} Credux\nSăn quái miễn phí.\n` +
			`Boss: cấp ${BOSS_ENTRY.minLevel}, phí ${n(BOSS_ENTRY.credux)} Credux, 1 lượt/ngày.\n` +
			bossStatus +
			'\nReset 00:00 Manila (23:00 Việt Nam).',
		buttons: [
			hunt,
			button('boss', 'Đánh boss', bossDone || p.level < BOSS_ENTRY.minLevel || p.credux < BOSS_ENTRY.credux),
			quests,
			...(hasBattle ? [button('result', 'Trận gần nhất')] : []),
		],
	};
}

function profileSummary(p: ProfileSummaryData): string {
	return (
		`**${escapeMarkdown(p.username)}**\n${CLASSES[p.combatClass].emoji} **${p.combatClass} · Cấp ${p.level}**\n` +
		`EXP ${renderProgressBar({ current: p.exp, max: p.expToNext })} \`${n(p.exp)}/${n(p.expToNext)}\`\n` +
		`💰 **${n(p.credux)}** Credux · 💎 **${n(p.beliefShards)}** shards\n`
	);
}

export function profilePanel(p: ProfileCardData): GamePanel {
	const summary = profileSummary(p);
	const gear = (item: { name: string; enhancement: number } | null | undefined) =>
		item ? `**${escapeMarkdown(item.name)}** · +${enhancementPlus(item.enhancement)}` : 'Chưa trang bị';
	const deities = p.loadout?.deities.length
		? p.loadout.deities.map((d) => `✦ **${escapeMarkdown(d.name)}** · ${d.sigils} Sigil`).join('\n')
		: 'Chưa có thần đồng hành';
	return {
		title: 'Nhân vật',
		withAvatar: true,
		grouped: true,
		body:
			summary +
			(p.title ? `*${escapeMarkdown(p.title)}*\n` : '') +
			`\n**Đang sử dụng**\n⚔️ Vũ khí: ${gear(p.loadout?.weapon)}\n🛡️ Giáp: ${gear(p.loadout?.armor)}\n` +
			`\n**Thần đồng hành**\n${deities}\n` +
			`\nHP ${n(p.stats.hp)} · ATK ${n(p.stats.atk)} · DEF ${n(p.stats.def)}`,
		buttons: [button('hunt', 'Săn quái')],
	};
}

export function homePanel(p: ProfileSummaryData, status: { dailyDone: boolean; bossDone: boolean }): GamePanel {
	const { dailyDone, bossDone } = status;
	const { dailyButton, hunt, quests } = activityButtons(dailyDone);
	return {
		title: 'Trang chủ',
		withAvatar: true,
		grouped: true,
		body: profileSummary(p),
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
		const pages = r.battle.roundLogs;
		const page = Math.max(0, Math.min(pages.length - 1, session.screen.page));
		return {
			title: `Nhật ký · ${page + 1}/${Math.max(1, pages.length)}`,
			body: pages[page]?.lines.join('\n').slice(-2800) || 'Không có log.',
			buttons: [
				button('first', 'Đầu', page === 0),
				button('prev', 'Trang trước', page === 0),
				button('next', 'Trang sau', page >= pages.length - 1),
				button('last', 'Cuối', page >= pages.length - 1),
				...(!r.boss ? [button('hunt', 'Đánh lại (15s)')] : []),
			],
		};
	}
	let outcome = 'Hoà';
	if (r.battle.outcome === 'player_win') outcome = 'Chiến thắng';
	else if (r.battle.outcome === 'enemy_win') outcome = 'Thất bại';
	return {
		title: 'Kết quả trận đấu',
		body:
			`${outcome} · ${escapeMarkdown(r.monsterName)}\n` +
			`${r.battle.rounds} hiệp · HP còn ${r.battle.playerHpRemaining}\n+${n(r.expGained)} EXP · +${n(r.credux)} Credux · +${n(r.shards)} shards\n` +
			(r.gotChest ? `+1 ${r.chestName}\n` : '') +
			(r.gearDrop ? `${r.gearDrop}\n` : '') +
			(r.progress.leveledUp ? `Lên cấp ${r.progress.previousLevel} → ${r.progress.newLevel}!\n` : '') +
			(r.boss ? `Phí vào boss: −${n(BOSS_ENTRY.credux)} Credux.\n` : ''),
		buttons: battlePanel({ battle: r, screen: { kind: 'log', page: Math.max(0, r.battle.roundLogs.length - 1) } })
			.buttons,
	};
}
