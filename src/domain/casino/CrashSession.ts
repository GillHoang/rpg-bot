import { rollChance } from '../../utils/weightedRandom.js';
import { crashChance, crashMultiplier, CRASH_MAX_PUSHES } from '../../config/casinoPayouts.js';

export interface CrashSessionState {
	bet: number;
	push: number; // pushes SURVIVED so far
	multiplier: number; // current safe cash-out multiplier (1 before any survived push)
	state: 'active' | 'crashed' | 'cashed';
	crashPoint: number | null;
	payout: number;
}

export interface PushResult {
	crashed: boolean;
	maxed?: boolean;
	push: number;
	multiplier: number;
}

/**
 * Pure session core, ported 1:1 from casino/crash.js. Each push rolls
 * crashChance(push) FIRST; a crash loses the already-debited bet, a
 * survival locks in crashMultiplier(push) as the new safe cash-out
 * value. Push 10 is the final attempt — after surviving it, only
 * cashing out is possible. The command layer (session Map, Push/Cash
 * Out buttons, 60s auto-cash-out timer, money path) is standard
 * Discord.js interaction-collector plumbing with no game-specific logic
 * in it, so it's left as a follow-up rather than built here — see README.
 */
export class CrashSession {
	static create(bet: number): CrashSessionState {
		return { bet, push: 0, multiplier: 1, state: 'active', crashPoint: null, payout: 0 };
	}

	static pushNext(s: CrashSessionState, rng: () => number): PushResult {
		if (s.state !== 'active') return { crashed: s.state === 'crashed', push: s.push, multiplier: s.multiplier };
		if (s.push >= CRASH_MAX_PUSHES) return { crashed: false, maxed: true, push: s.push, multiplier: s.multiplier };

		const n = s.push + 1;
		const chance = crashChance(n);
		if (rollChance(chance / 100, rng)) {
			s.state = 'crashed';
			s.push = n;
			s.crashPoint = crashMultiplier(n);
			s.payout = 0;
			return { crashed: true, push: n, multiplier: s.crashPoint };
		}
		s.push = n;
		s.multiplier = crashMultiplier(n);
		return { crashed: false, maxed: n >= CRASH_MAX_PUSHES, push: n, multiplier: s.multiplier };
	}

	static cashOut(s: CrashSessionState): number {
		if (s.state !== 'active') return s.payout;
		s.state = 'cashed';
		s.payout = Math.floor(s.bet * s.multiplier);
		return s.payout;
	}
}
