import { formatNumber } from '../../shared/ui/text/format.js';
import { ICONS } from '../../shared/ui/text/icons.js';
import { GAMEPLAY_TEXT } from '../../shared/ui/text/gameplay.js';
import { enhancementPlus } from '../../shared/utils/enhancementDisplay.js';
import { escapeMarkdown } from 'discord.js';
import { CLASSES } from '../../shared/config/classes.js';
import { BOSS_ENTRY } from '../../shared/config/raidLoot.js';
import { GRANT_BELIEF_SHARDS, GRANT_SILVER_CHESTS } from '../../shared/config/starter.js';
import type { QuestType } from '../../shared/config/quests.js';
import type { ProfileSummaryData } from '../identity/application/ProfileService.js';
import type { ProfileCardData } from '../../shared/ui/render/ProfileCardRenderer.js';
import type { QuestSnapshot } from '../meta/application/QuestService.js';
import { MENU_QUEST_LABELS } from '../../shared/ui/text/menu.js';
import { renderProgressBar } from '../../shared/utils/progressBar.js';
import type { GamePanel, MenuBattle } from './MenuGameplay.js';
import type { MenuScreen, MenuSession } from './MenuSessionStore.js';
import { GATES, TIERS_PER_GATE } from '../../shared/config/portals.js';
import { GATE_TEXT } from '../../shared/ui/text/portals.js';

/**
 * Pure panel builders: they own the title/body and the dynamic `data` values
 * that registered menu items read for labels/disabled state. Button sets are
 * NOT declared here — `MenuRegistry.buildPanelButtons` derives them from the
 * files under `menu/items/`.
 */

const n = (value: number) => formatNumber(Number(value), 'vi-VN');

export function confirmationPanel(screen: Extract<MenuScreen, { kind: 'confirm' }>): GamePanel {
	if (screen.operation === 'start') {
		const c = CLASSES[screen.combatClass];
		return {
			title: GAMEPLAY_TEXT.chooseClass(screen.combatClass),
			body:
				`> ${c.flavor}\n${c.passiveLine}\n\n` +
				GAMEPLAY_TEXT.baseStats(c.base.hp, c.base.atk, c.base.def, c.base.crit) +
				GAMEPLAY_TEXT.starterRewards(n(GRANT_BELIEF_SHARDS), GRANT_SILVER_CHESTS),
			classes: true,
		};
	}
	return {
		title: screen.operation === 'boss' ? GAMEPLAY_TEXT.confirmBoss : GAMEPLAY_TEXT.confirmReroll,
		body:
			screen.operation === 'boss'
				? GAMEPLAY_TEXT.bossConfirmation(BOSS_ENTRY.minLevel, n(BOSS_ENTRY.credux), screen.day)
				: GAMEPLAY_TEXT.rerollConfirmation(screen.day),
	};
}

export function onboardingPanel(): GamePanel {
	return {
		title: GAMEPLAY_TEXT.onboardingTitle,
		body: GAMEPLAY_TEXT.onboardingBody,
		classes: true,
	};
}

export function questsPanel(q: QuestSnapshot, dailyDone: boolean): GamePanel {
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
		data: {
			dailyDone,
			claimDisabled: !q.grandReady,
			rerollDisabled: !q.refreshAvailable || q.dailies.every((x) => x.completed),
		},
	};
}

export function battleLobbyPanel(p: ProfileSummaryData, bossDone: boolean, hasBattle: boolean): GamePanel {
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
		data: {
			bossDisabled: bossDone || p.level < BOSS_ENTRY.minLevel || p.credux < BOSS_ENTRY.credux,
			hasBattle,
		},
	};
}

function profileSummary(p: ProfileSummaryData): string {
	return (
		GAMEPLAY_TEXT.profileHeading(escapeMarkdown(p.username), CLASSES[p.combatClass].emoji, p.combatClass, p.level) +
		GAMEPLAY_TEXT.profileExp(renderProgressBar({ current: p.exp, max: p.expToNext }), n(p.exp), n(p.expToNext)) +
		GAMEPLAY_TEXT.profileCurrency(n(p.credux), n(p.beliefShards))
	);
}

export type ProfileTab = 'stats' | 'gear' | 'deity';

export function profilePanel(p: ProfileCardData, tab: ProfileTab = 'stats'): GamePanel {
	const summary = profileSummary(p);
	const gear = (item: { name: string; enhancement: number } | null | undefined) =>
		item
			? GAMEPLAY_TEXT.gearRow(escapeMarkdown(item.name), enhancementPlus(item.enhancement))
			: GAMEPLAY_TEXT.unequipped;
	const deities = p.loadout?.deities.length
		? p.loadout.deities.map((d) => GAMEPLAY_TEXT.deityRow(escapeMarkdown(d.name), d.sigils)).join('\n')
		: GAMEPLAY_TEXT.noDeities;
	const title = p.title ? `*${escapeMarkdown(p.title)}*\n` : '';
	const section =
		tab === 'gear'
			? GAMEPLAY_TEXT.equipmentSection(gear(p.loadout?.weapon), gear(p.loadout?.armor))
			: tab === 'deity'
				? GAMEPLAY_TEXT.deitiesSection(deities)
				: GAMEPLAY_TEXT.combatStats(n(p.stats.hp), n(p.stats.atk), n(p.stats.def));
	return {
		title: GAMEPLAY_TEXT.profile,
		withAvatar: true,
		grouped: true,
		body: summary + title + section,
	};
}

export function homePanel(p: ProfileSummaryData, status: { dailyDone: boolean; bossDone: boolean }): GamePanel {
	return {
		title: GAMEPLAY_TEXT.home,
		withAvatar: true,
		grouped: true,
		body: profileSummary(p),
		data: {
			dailyDone: status.dailyDone,
			bossDisabled: status.bossDone || p.level < BOSS_ENTRY.minLevel || p.credux < BOSS_ENTRY.credux,
		},
	};
}

/** Character budget shared by logPages() and the single-page log view below. */
export const MENU_LOG_PAGE_CHARS = 2800;

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
			if (page.length + character.length > MENU_LOG_PAGE_CHARS) {
				pages.push(page);
				page = '';
			}
			page += character;
		}
		if (page) pages.push(page);
		return pages;
	});
}

/** Label for the "continue" item after a portal fight, or undefined when there is no next step. */
export function continuationLabel(battle: MenuBattle): string | undefined {
	if (battle.boss || !battle.portal) return undefined;
	if (battle.battle.outcome !== 'player_win') return GATE_TEXT.retryTier;
	if (battle.portal.tier < TIERS_PER_GATE) return GATE_TEXT.nextTier;
	if (battle.portal.gate < GATES.length) return GATE_TEXT.nextGate;
	return undefined;
}

export function battlePanel(session: Pick<MenuSession, 'battle' | 'screen'>): GamePanel {
	const r = session.battle;
	if (!r) {
		return {
			title: GAMEPLAY_TEXT.battleTitle,
			body: GAMEPLAY_TEXT.noBattle,
			data: { hasBattle: false, boss: false },
		};
	}
	const total = r.battle.roundLogs.length;
	const page = Math.max(0, Math.min(total - 1, session.screen.kind === 'log' ? session.screen.page : total - 1));
	const continuation = continuationLabel(r);
	const data = {
		boss: r.boss,
		hasBattle: true,
		page,
		pages: total,
		continuation: continuation ? { label: continuation } : null,
	};
	if (session.screen.kind === 'log') {
		return {
			title: GAMEPLAY_TEXT.logTitle(page + 1, Math.max(1, total)),
			body: r.battle.roundLogs[page]?.lines.join('\n').slice(-MENU_LOG_PAGE_CHARS) || GAMEPLAY_TEXT.noLog,
			data,
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
		data,
	};
}
