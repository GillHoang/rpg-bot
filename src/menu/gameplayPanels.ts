import { formatNumber } from '../text/format.js';
import { ICONS } from '../text/icons.js';
import { GAMEPLAY_TEXT } from '../text/gameplay.js';
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

const n = (value: number) => formatNumber(Number(value));
const button = (action: MenuAction, label: string, disabled = false): GamePanel['buttons'][number] => ({
	action,
	label,
	disabled,
});
const cancel = button('cancel', GAMEPLAY_TEXT.cancel);

function activityButtons(dailyDone: boolean) {
	return {
		dailyButton: button('daily', dailyDone ? GAMEPLAY_TEXT.dailyClaimed : GAMEPLAY_TEXT.dailyClaim, dailyDone),
		hunt: button('hunt', GAMEPLAY_TEXT.hunt),
		quests: button('quests', GAMEPLAY_TEXT.quests),
	};
}

export function confirmationPanel(screen: Extract<MenuScreen, { kind: 'confirm' }>): GamePanel {
	if (screen.operation === 'start') {
		const c = CLASSES[screen.combatClass];
		return {
			title: GAMEPLAY_TEXT.chooseClass(screen.combatClass),
			body:
				`> ${c.flavor}\n${c.passiveLine}\n\n` +
				GAMEPLAY_TEXT.baseStats(c.base.hp, c.base.atk, c.base.def, c.base.crit) +
				GAMEPLAY_TEXT.starterRewards(n(GRANT_BELIEF_SHARDS), GRANT_SILVER_CHESTS),
			buttons: [button('confirm', GAMEPLAY_TEXT.createCharacter), cancel],
			classes: true,
		};
	}
	return {
		title: screen.operation === 'boss' ? GAMEPLAY_TEXT.confirmBoss : GAMEPLAY_TEXT.confirmReroll,
		body:
			screen.operation === 'boss'
				? GAMEPLAY_TEXT.bossConfirmation(BOSS_ENTRY.minLevel, n(BOSS_ENTRY.credux), screen.day)
				: GAMEPLAY_TEXT.rerollConfirmation(screen.day),
		buttons: [{ action: 'confirm', label: GAMEPLAY_TEXT.confirm, danger: true }, cancel],
	};
}

export function onboardingPanel(): GamePanel {
	return {
		title: GAMEPLAY_TEXT.onboardingTitle,
		body: GAMEPLAY_TEXT.onboardingBody,
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
				const bonus =
					'rewardValor' in row
						? GAMEPLAY_TEXT.valorReward(row.rewardValor)
						: GAMEPLAY_TEXT.shardReward(row.rewardBeliefShards);
				const progress = row.completed ? ICONS.status.completed : `${row.currentCount}/${row.targetCount}`;
				return GAMEPLAY_TEXT.questRow(progress, label, n(row.rewardCredux), bonus);
			})
			.join('\n');
	let grandStatus = GAMEPLAY_TEXT.weeklyIncomplete;
	if (q.grandClaimed) grandStatus = GAMEPLAY_TEXT.weeklyClaimed;
	else if (q.grandReady) grandStatus = GAMEPLAY_TEXT.weeklyReady;
	return {
		title: GAMEPLAY_TEXT.questsTitle,
		body:
			GAMEPLAY_TEXT.questSections(q.day, rows(false), q.week, rows(true)) + grandStatus + GAMEPLAY_TEXT.questHint,
		buttons: [
			dailyButton,
			hunt,
			button('claim', GAMEPLAY_TEXT.claimWeekly, !q.grandReady),
			button('reroll', GAMEPLAY_TEXT.rerollDaily, !q.refreshAvailable || q.dailies.every((x) => x.completed)),
		],
	};
}

export function battleLobbyPanel(p: ProfileSummaryData, bossDone: boolean, hasBattle: boolean): GamePanel {
	const hunt = button('hunt', GAMEPLAY_TEXT.hunt);
	const quests = button('quests', GAMEPLAY_TEXT.quests);
	let bossStatus = GAMEPLAY_TEXT.bossReady;
	if (bossDone) bossStatus = GAMEPLAY_TEXT.bossDone;
	else if (p.level < BOSS_ENTRY.minLevel) bossStatus = GAMEPLAY_TEXT.bossLowLevel;
	else if (p.credux < BOSS_ENTRY.credux) bossStatus = GAMEPLAY_TEXT.bossLowBalance;
	return {
		title: GAMEPLAY_TEXT.battleLobbyTitle,
		body:
			GAMEPLAY_TEXT.huntInfo(p.level, n(p.credux)) +
			GAMEPLAY_TEXT.bossInfo(BOSS_ENTRY.minLevel, n(BOSS_ENTRY.credux)) +
			bossStatus +
			GAMEPLAY_TEXT.resetTime,
		buttons: [
			hunt,
			button(
				'boss',
				GAMEPLAY_TEXT.boss,
				bossDone || p.level < BOSS_ENTRY.minLevel || p.credux < BOSS_ENTRY.credux,
			),
			quests,
			...(hasBattle ? [button('result', GAMEPLAY_TEXT.lastBattle)] : []),
		],
	};
}

function profileSummary(p: ProfileSummaryData): string {
	return (
		GAMEPLAY_TEXT.profileHeading(escapeMarkdown(p.username), CLASSES[p.combatClass].emoji, p.combatClass, p.level) +
		GAMEPLAY_TEXT.profileExp(renderProgressBar({ current: p.exp, max: p.expToNext }), n(p.exp), n(p.expToNext)) +
		GAMEPLAY_TEXT.profileCurrency(n(p.credux), n(p.beliefShards))
	);
}

export function profilePanel(p: ProfileCardData): GamePanel {
	const summary = profileSummary(p);
	const gear = (item: { name: string; enhancement: number } | null | undefined) =>
		item
			? GAMEPLAY_TEXT.gearRow(escapeMarkdown(item.name), enhancementPlus(item.enhancement))
			: GAMEPLAY_TEXT.unequipped;
	const deities = p.loadout?.deities.length
		? p.loadout.deities.map((d) => GAMEPLAY_TEXT.deityRow(escapeMarkdown(d.name), d.sigils)).join('\n')
		: GAMEPLAY_TEXT.noDeities;
	return {
		title: GAMEPLAY_TEXT.profile,
		withAvatar: true,
		grouped: true,
		body:
			summary +
			(p.title ? `*${escapeMarkdown(p.title)}*\n` : '') +
			GAMEPLAY_TEXT.equipmentSection(gear(p.loadout?.weapon), gear(p.loadout?.armor)) +
			GAMEPLAY_TEXT.deitiesSection(deities) +
			GAMEPLAY_TEXT.combatStats(n(p.stats.hp), n(p.stats.atk), n(p.stats.def)),
		buttons: [button('hunt', GAMEPLAY_TEXT.hunt)],
	};
}

export function homePanel(p: ProfileSummaryData, status: { dailyDone: boolean; bossDone: boolean }): GamePanel {
	const { dailyDone, bossDone } = status;
	const { dailyButton, hunt, quests } = activityButtons(dailyDone);
	return {
		title: GAMEPLAY_TEXT.home,
		withAvatar: true,
		grouped: true,
		body: profileSummary(p),
		buttons: [
			...[
				button('profile', GAMEPLAY_TEXT.profile),
				button('help', GAMEPLAY_TEXT.help),
				button('search', GAMEPLAY_TEXT.searchHelp),
			].map((b) => ({ ...b, group: GAMEPLAY_TEXT.infoGroup })),
			...[
				dailyButton,
				hunt,
				button(
					'boss',
					GAMEPLAY_TEXT.boss,
					bossDone || p.level < BOSS_ENTRY.minLevel || p.credux < BOSS_ENTRY.credux,
				),
				quests,
			].map((b) => ({ ...b, group: GAMEPLAY_TEXT.activityGroup })),
			...[
				button('inventory', GAMEPLAY_TEXT.inventory),
				button('deity', GAMEPLAY_TEXT.deitySummon),
				button('shop', GAMEPLAY_TEXT.shop),
				button('casino', GAMEPLAY_TEXT.casino),
			].map((b) => ({ ...b, group: GAMEPLAY_TEXT.assetsGroup })),
		],
	};
}

/** Split long rounds instead of silently dropping combat events at the text limit. */
export function logPages(result: MenuBattle): string[] {
	return result.battle.roundLogs.flatMap((round) => {
		const text = GAMEPLAY_TEXT.roundLog(
			round.round,
			round.playerHp,
			round.playerMaxHp,
			round.enemyHp,
			round.enemyMaxHp,
			round.lines.join('\n'),
		);
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
			title: GAMEPLAY_TEXT.battleTitle,
			body: GAMEPLAY_TEXT.noBattle,
			buttons: [button('hunt', GAMEPLAY_TEXT.hunt)],
		};
	if (session.screen.kind === 'log') {
		const pages = r.battle.roundLogs;
		const page = Math.max(0, Math.min(pages.length - 1, session.screen.page));
		return {
			title: GAMEPLAY_TEXT.logTitle(page + 1, Math.max(1, pages.length)),
			body: pages[page]?.lines.join('\n').slice(-2800) || GAMEPLAY_TEXT.noLog,
			buttons: [
				button('first', GAMEPLAY_TEXT.first, page === 0),
				button('prev', GAMEPLAY_TEXT.previous, page === 0),
				button('next', GAMEPLAY_TEXT.next, page >= pages.length - 1),
				button('last', GAMEPLAY_TEXT.last, page >= pages.length - 1),
				...(!r.boss ? [button('hunt', GAMEPLAY_TEXT.replay)] : []),
			],
		};
	}
	let outcome = GAMEPLAY_TEXT.draw;
	if (r.battle.outcome === 'player_win') outcome = GAMEPLAY_TEXT.win;
	else if (r.battle.outcome === 'enemy_win') outcome = GAMEPLAY_TEXT.lose;
	return {
		title: GAMEPLAY_TEXT.resultTitle,
		body:
			`${outcome} · ${escapeMarkdown(r.monsterName)}\n` +
			GAMEPLAY_TEXT.battleRewards(
				r.battle.rounds,
				r.battle.playerHpRemaining,
				n(r.expGained),
				n(r.credux),
				n(r.shards),
			) +
			(r.gotChest ? `+1 ${r.chestName}\n` : '') +
			(r.gearDrop ? `${r.gearDrop}\n` : '') +
			(r.progress.leveledUp ? GAMEPLAY_TEXT.levelUp(r.progress.previousLevel, r.progress.newLevel) : '') +
			(r.boss ? GAMEPLAY_TEXT.bossFee(n(BOSS_ENTRY.credux)) : ''),
		buttons: battlePanel({ battle: r, screen: { kind: 'log', page: Math.max(0, r.battle.roundLogs.length - 1) } })
			.buttons,
	};
}
