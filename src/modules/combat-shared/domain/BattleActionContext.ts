import { randomUUID } from 'node:crypto';
import { createSecureSeed } from './Rng.js';

export type BattleMode = 'raid' | 'boss' | 'duel' | 'ranked';

/** Immutable inputs shared by every battle use case for one attempt. */
export interface BattleActionContext {
	actionId: string;
	actorId: string;
	mode: BattleMode;
	now: Date;
	seed: number;
}

export function createBattleActionContext(input: {
	actorId: string;
	mode: BattleMode;
	actionId?: string;
	now?: Date;
	seed?: number;
}): BattleActionContext {
	return {
		actionId: input.actionId ?? randomUUID(),
		actorId: input.actorId,
		mode: input.mode,
		now: input.now ?? new Date(),
		seed: input.seed ?? createSecureSeed(),
	};
}
