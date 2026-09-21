import { eq } from 'drizzle-orm';
import { escapeMarkdown } from 'discord.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { CLASS_NAMES, CLASSES } from '../config/classes.js';
import { BOSS_ENTRY } from '../config/raidLoot.js';
import { GRANT_BELIEF_SHARDS, GRANT_SILVER_CHESTS } from '../config/starter.js';
import { ProfileService } from '../services/ProfileService.js';
import { StartService } from '../services/StartService.js';
import { DailyService } from '../services/DailyService.js';
import { QuestService } from '../services/QuestService.js';
import { RaidService } from '../services/RaidService.js';
import { DailyCycle } from '../utils/dailyCycle.js';
import { DAILY_ALREADY_CLAIMED, DAILY_MILESTONE_LINE, DAILY_SUCCESS } from '../text/daily.js';
import { MENU_QUEST_LABELS } from '../text/menu.js';
import type { QuestType } from '../config/quests.js';
import type { GamePanel, MenuGameplay, MenuBattle } from './MenuGameplay.js';
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

export class MenuGameplayService implements MenuGameplay {
	constructor(
		private readonly profiles = new ProfileService(),
		private readonly start = new StartService(),
		private readonly daily = new DailyService(),
		private readonly quests = new QuestService(),
		private readonly raid = new RaidService(),
	) {}

	async render(session: MenuSession): Promise<GamePanel | undefined> {
		const screen = session.screen;
		if (['help', 'topic', 'search'].includes(screen.kind)) return undefined;
		if (screen.kind === 'section' && !['character', 'daily', 'battle'].includes(screen.section)) return undefined;
		if (screen.kind === 'result' || screen.kind === 'log') return this.battlePanel(session);
		if (screen.kind === 'confirm') {
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
		const profile = await this.profiles.get(session.ownerId);
		if (profile.status !== 'ok')
			return {
				title: 'Bắt đầu hành trình',
				body: 'Chọn một class bên dưới để xem chỉ số và tạo nhân vật. Sau đó bạn có thể nhận daily và săn quái ngay trong menu này.',
				classes: true,
				buttons: [],
			};
		const p = profile.data;
		const [user] = await db.select().from(users).where(eq(users.discordId, session.ownerId));
		const day = DailyCycle.keyAt();
		const dailyDone = user?.lastDailyClaimDate === day;
		const bossDone = user?.lastBossAttackDate === day;
		const dailyButton = button('daily', dailyDone ? 'Đã nhận daily' : 'Nhận daily', dailyDone);
		const hunt = button('hunt', 'Săn quái');
		const quests = button('quests', 'Nhiệm vụ');
		const kind =
			screen.kind === 'section'
				? ({ character: 'profile', daily: 'quests', battle: 'battle' } as Record<string, string>)[
						screen.section
					]
				: screen.kind;
		if (kind === 'quests') {
			const q = await this.quests.snapshot(session.ownerId);
			if (!q) throw new Error('Menu player disappeared');
			const rows = (weekly: boolean) =>
				(weekly ? q.weeklies : q.dailies)
					.map((row) => {
						const label = MENU_QUEST_LABELS[row.questType as QuestType];
						const bonus =
							'rewardValor' in row ? `${row.rewardValor} Valor` : `${row.rewardBeliefShards} shards`;
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
		if (kind === 'battle')
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
					button(
						'boss',
						'Đánh boss',
						bossDone || p.level < BOSS_ENTRY.minLevel || p.credux < BOSS_ENTRY.credux,
					),
					quests,
					...(session.battle ? [button('result', 'Trận gần nhất')] : []),
				],
			};
		const summary =
			`**${escapeMarkdown(p.username)}**\n${CLASSES[p.combatClass].emoji} **${p.combatClass} · Cấp ${p.level}**\n` +
			`EXP ${expBar(p.exp, p.expToNext)} \`${n(p.exp)}/${n(p.expToNext)}\`\n` +
			`💰 **${n(p.credux)}** Credux · 💎 **${n(p.beliefShards)}** shards\n`;
		if (kind === 'profile')
			return {
				title: 'Nhân vật',
				withAvatar: true,
				body:
					summary +
					`\nHP ${n(p.stats.hp)} · ATK ${n(p.stats.atk)} · DEF ${n(p.stats.def)} · Crit ${p.stats.crit.toFixed(1)}%\n` +
					`Tín đồ cấp ${p.believerLevel ?? 1} · EXP ${n(p.believerExp ?? 0)} · PvP ${p.pvpRating ?? 0}\n${p.title ? escapeMarkdown(p.title) : 'Chưa trang bị danh hiệu.'}`,
				buttons: [dailyButton, hunt, quests],
			};
		const q = await this.quests.snapshot(session.ownerId);
		return {
			title: 'Trang chủ',
			withAvatar: true,
			grouped: true,
			body:
				summary +
				`\nDaily: ${dailyDone ? 'đã nhận' : 'sẵn sàng'} · Chuỗi ${user?.overallStreak ?? 0} ngày\n` +
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
					button(
						'boss',
						'Đánh boss',
						bossDone || p.level < BOSS_ENTRY.minLevel || p.credux < BOSS_ENTRY.credux,
					),
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

	async act(session: MenuSession, action: MenuAction, username: string, value?: string): Promise<MenuScreen> {
		const id = session.ownerId;
		switch (action) {
			case 'inventory':
			case 'deity':
			case 'shop':
			case 'casino':
				return { kind: 'section', section: action };
			case 'battle':
				return { kind: 'battle' };
			case 'class': {
				const combatClass = CLASS_NAMES.find((c) => c === value);
				if (!combatClass) throw new Error('Invalid class');
				return { kind: 'confirm', operation: 'start', combatClass };
			}
			case 'profile':
				return { kind: 'profile' };
			case 'quests':
				return { kind: 'quests' };
			case 'daily': {
				const r = await this.daily.claim(id, new Date(), true);
				session.notice =
					r.status === 'ok'
						? DAILY_SUCCESS(
								r.day,
								r.monthly,
								r.overall,
								n(r.credux),
								r.shards,
								r.chestLabel,
								r.milestoneChestLabel ? DAILY_MILESTONE_LINE(r.milestoneChestLabel) : '',
							)
						: r.status === 'already-claimed'
							? DAILY_ALREADY_CLAIMED(r.overall)
							: 'Hãy tạo nhân vật trước.';
				return { kind: 'home' };
			}
			case 'claim':
				session.notice = await this.quests.claimWeeklyGrand(id);
				return { kind: 'quests' };
			case 'reroll':
			case 'boss':
				return { kind: 'confirm', operation: action, day: DailyCycle.keyAt() };
			case 'cancel':
				return session.screen.kind === 'confirm' && session.screen.operation === 'reroll'
					? { kind: 'quests' }
					: session.screen.kind === 'confirm' && session.screen.operation === 'boss'
						? { kind: 'battle' }
						: { kind: 'home' };
			case 'confirm': {
				const s = session.screen;
				if (s.kind !== 'confirm') throw new Error('Confirmation missing');
				if (s.operation === 'start') {
					const r = await this.start.start(id, username, s.combatClass);
					session.notice =
						r.status === 'ok'
							? 'Đã tạo nhân vật và nhận quà khởi đầu! Chọn Nhận daily hoặc Săn quái để chơi.'
							: r.status === 'already-has-character'
								? 'Bạn đã có nhân vật.'
								: 'Dữ liệu trang bị khởi đầu chưa sẵn sàng. Hãy thử lại sau.';
					return { kind: 'home' };
				}
				if (s.operation === 'reroll') {
					session.notice = await this.quests.refresh(id, s.day);
					return { kind: 'quests' };
				}
				return this.fight(session, true, s.day);
			}
			case 'hunt':
				return this.fight(session, false);
			case 'result':
				return { kind: 'result' };
			case 'log':
				return { kind: 'log', page: 0 };
			case 'prev':
			case 'next': {
				if (session.screen.kind !== 'log' || !session.battle) throw new Error('No battle log');
				return {
					kind: 'log',
					page: Math.max(
						0,
						Math.min(
							this.logPages(session.battle).length - 1,
							session.screen.page + (action === 'next' ? 1 : -1),
						),
					),
				};
			}
			default:
				throw new Error('Unknown gameplay action');
		}
	}

	private async fight(session: MenuSession, boss: boolean, expectedDay?: string): Promise<MenuScreen> {
		const r = await this.raid.run(session.ownerId, boss, {
			requestId: `${session.id}:${session.revision}`,
			atomicProgress: true,
			expectedDay,
		});
		if (r.status === 'ok') {
			session.battle = { ...r, boss };
			return { kind: 'result' };
		}
		session.notice =
			r.status === 'boss-locked'
				? r.message
				: r.status === 'already-processed'
					? 'Trận đấu đã được xử lý; không nhận thưởng lần hai.'
					: r.status === 'no-monsters-seeded'
						? 'Chưa có quái phù hợp. Hãy thử lại sau.'
						: 'Hãy tạo nhân vật trước.';
		return { kind: 'battle' };
	}

	/** Split long rounds instead of silently dropping combat events at the text limit. */
	private logPages(result: MenuBattle): string[] {
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

	private battlePanel(session: MenuSession): GamePanel {
		const r = session.battle;
		if (!r)
			return {
				title: 'Chiến đấu',
				body: 'Chưa có trận đấu trong menu này.',
				buttons: [button('hunt', 'Săn quái')],
			};
		if (session.screen.kind === 'log') {
			const pages = this.logPages(r);
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
}

export const menuGameplay = new MenuGameplayService();
