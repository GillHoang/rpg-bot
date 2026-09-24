import { BRACKETS, eloDelta, bracketFor, type Bracket } from '../../../shared/config/ranked.js';

/**
 * SRP extraction from RankedService: pure Elo + demotion-shield rules.
 * No DB, no clock, no events — fully unit-testable.
 */
export interface RatingChange {
	rating: number;
	shield: boolean;
	shieldUsed: boolean;
	promoted: boolean;
}

export function resolveRatingChange(
	beforeRating: number,
	rawAfterRating: number,
	hadShield: boolean,
): RatingChange {
	const before = bracketFor(beforeRating);
	const after = bracketFor(rawAfterRating);
	const index = (b: Bracket) => BRACKETS.findIndex((x) => x.name === b.name);
	let rating = rawAfterRating;
	let shieldUsed = false;
	if (index(after) < index(before) && hadShield) {
		rating = before.min;
		shieldUsed = true;
	}
	const promoted = index(after) > index(before);
	let shield = hadShield;
	if (promoted) shield = true;
	else if (shieldUsed) shield = false;
	return { rating, shield, shieldUsed, promoted };
}

export function applyElo(
	playerRating: number,
	opponentRating: number,
	score: 0 | 0.5 | 1,
): number {
	return Math.max(0, playerRating + eloDelta(playerRating, opponentRating, score));
}
