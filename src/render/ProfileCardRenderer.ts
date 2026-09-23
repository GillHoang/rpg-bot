import { formatNumber } from '../text/format.js';
import {
	PROFILE_EXTRA_TEXT,
	PROFILE_CLASS_SEPARATOR,
	PROFILE_EXP_LABEL,
	PROFILE_LEVEL_PREFIX,
	PROFILE_MAX_LEVEL_SUFFIX,
	PROFILE_STAT_LABELS,
	PROFILE_CLASS_ICONS,
} from '../text/profile.js';
import { createCanvas } from '@napi-rs/canvas';
import { CLASSES } from '../config/classes.js';
import type { CombatClass } from '../domain/entities/PlayerAccount.js';
import { MAX_COMBAT_LEVEL } from '../config/combatExp.js';
import { CURRENCY } from '../text/common.js';

import { UNICODE_ICONS } from '../text/icons.js';

export interface ProfileCardData {
	username: string;
	combatClass: CombatClass;
	level: number;
	exp: number;
	expToNext: number;
	stats: { hp: number; atk: number; def: number; crit: number };
	credux: number;
	beliefShards: number;
	loadout?: {
		weapon: { name: string; enhancement: number } | null;
		armor: { name: string; enhancement: number } | null;
		deities: { name: string; sigils: number }[];
	};
	/** M7 extras — optional so callers outside the RPG flow still render. */
	title?: string | null;
	believerLevel?: number;
	believerExp?: number;
	pvpRating?: number;
}

const WIDTH = 900;
const HEIGHT = 500;

const CLASS_COLOR: Record<CombatClass, string> = {
	Swordsman: '#c0392b',
	Fighter: '#d35400',
	Mage: '#8e44ad',
	Knight: '#2980b9',
	Archer: '#27ae60',
};

/**
 * M2 (was entirely unported). Draws a plain, code-only card — solid
 * shapes and system fonts, no external image/font assets, since none
 * shipped with the source we received. Ready to swap for the original's
 * class-portrait art + custom fonts once those asset files are supplied;
 * the layout math (bar widths, text baselines) stays the same either way.
 */
export function renderProfileCard(data: ProfileCardData): Buffer {
	const canvas = createCanvas(WIDTH, HEIGHT);
	const ctx = canvas.getContext('2d');
	const accent = CLASS_COLOR[data.combatClass];

	// Background.
	const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
	bg.addColorStop(0, '#1b1f27');
	bg.addColorStop(1, '#2a2f3a');
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, WIDTH, HEIGHT);

	// Accent header bar.
	ctx.fillStyle = accent;
	ctx.fillRect(0, 0, WIDTH, 10);

	// Name + class.
	ctx.fillStyle = '#ffffff';
	ctx.font = 'bold 40px sans-serif';
	ctx.fillText(data.username, 40, 80);

	const cls = CLASSES[data.combatClass];
	ctx.fillStyle = accent;
	ctx.font = 'bold 26px sans-serif';
	const maxSuffix = data.level >= MAX_COMBAT_LEVEL ? PROFILE_MAX_LEVEL_SUFFIX : '';
	ctx.fillText(
		`${PROFILE_CLASS_ICONS[data.combatClass]} ${data.combatClass} ${PROFILE_CLASS_SEPARATOR} ${PROFILE_LEVEL_PREFIX}${data.level}${maxSuffix}`,
		40,
		120,
	);

	// EXP bar.
	const expBarX = 40;
	const expBarY = 145;
	const expBarW = WIDTH - 80;
	const expBarH = 18;
	const expPct = data.expToNext > 0 ? Math.min(1, data.exp / data.expToNext) : 1;
	ctx.fillStyle = '#00000055';
	ctx.fillRect(expBarX, expBarY, expBarW, expBarH);
	ctx.fillStyle = accent;
	ctx.fillRect(expBarX, expBarY, expBarW * expPct, expBarH);
	ctx.fillStyle = '#ffffffaa';
	ctx.font = '13px sans-serif';
	ctx.fillText(
		`${formatNumber(data.exp)} / ${formatNumber(data.expToNext)} ${PROFILE_EXP_LABEL}`,
		expBarX,
		expBarY - 6,
	);

	// Stat blocks.
	const stats: Array<[string, string]> = [
		[PROFILE_STAT_LABELS.hp, formatNumber(data.stats.hp)],
		[PROFILE_STAT_LABELS.atk, formatNumber(data.stats.atk)],
		[PROFILE_STAT_LABELS.def, formatNumber(data.stats.def)],
		[PROFILE_STAT_LABELS.crit, `${data.stats.crit.toFixed(1)}%`],
	];
	const blockW = (WIDTH - 80 - 3 * 20) / 4;
	stats.forEach(([label, value], i) => {
		const x = 40 + i * (blockW + 20);
		const y = 200;
		ctx.fillStyle = '#00000044';
		ctx.fillRect(x, y, blockW, 90);
		ctx.fillStyle = '#ffffff88';
		ctx.font = '16px sans-serif';
		ctx.fillText(label, x + 14, y + 30);
		ctx.fillStyle = '#ffffff';
		ctx.font = 'bold 28px sans-serif';
		ctx.fillText(value, x + 14, y + 66);
	});

	// Currency footer.
	ctx.fillStyle = '#ffffffcc';
	ctx.font = '20px sans-serif';
	ctx.fillText(`${UNICODE_ICONS.economy.wallet} ${formatNumber(data.credux)} ${CURRENCY.credux}`, 40, 340);
	ctx.fillText(
		`${UNICODE_ICONS.economy.shards} ${formatNumber(data.beliefShards)} ${CURRENCY.beliefShards}`,
		40,
		375,
	);

	// M7 line: title · believer level · pvp rating (when provided).
	const m7Parts: string[] = [];
	if (data.title) m7Parts.push(`${UNICODE_ICONS.gear.titles} ${data.title}`);
	if (data.believerLevel != null)
		m7Parts.push(
			PROFILE_EXTRA_TEXT.believer(
				UNICODE_ICONS.deity.believer,
				data.believerLevel,
				formatNumber(data.believerExp ?? 0),
			),
		);
	if (data.pvpRating != null)
		m7Parts.push(PROFILE_EXTRA_TEXT.rating(UNICODE_ICONS.ranked.profileBadge, data.pvpRating));
	if (m7Parts.length > 0) {
		ctx.fillStyle = '#ffffffaa';
		ctx.font = '16px sans-serif';
		ctx.fillText(m7Parts.join('  ·  '), 40, 410);
	}

	ctx.fillStyle = '#ffffff55';
	ctx.font = 'italic 14px sans-serif';
	ctx.fillText(cls.passiveName, 40, HEIGHT - 30);

	return canvas.toBuffer('image/png');
}
