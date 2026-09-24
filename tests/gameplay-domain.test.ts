import { describe, expect, it, vi } from 'vitest';
import { chance, rollChest } from '../src/shared/config/chestLoot.js';
import { resolveRoll } from '../src/shared/config/gachaRates.js';
import { createRng } from '../src/modules/combat-shared/domain/Rng.js';
import { newDeck } from '../src/modules/casino/domain/CardDeck.js';
import { SlotMachineGame } from '../src/modules/casino/domain/games/SlotMachineGame.js';
import { replayGame } from '../src/modules/casino/domain/InteractiveGame.js';
import { CrashSession } from '../src/modules/casino/domain/CrashSession.js';
import { BlackjackSession } from '../src/modules/casino/domain/BlackjackSession.js';
import { createCombatant } from '../src/modules/combat-shared/domain/CombatantState.js';
import { RuneStrategyDecorator } from '../src/modules/combat-shared/domain/RuneStrategyDecorator.js';
import { NullClassStrategy } from '../src/modules/combat-shared/domain/classes/NullClassStrategy.js';
import { MonsterStrategy } from '../src/modules/combat-shared/domain/classes/MonsterStrategy.js';
import { BattleEngine } from '../src/modules/combat-shared/domain/BattleEngine.js';
import { computeSigilStats } from '../src/shared/config/ascension.js';

describe('seeded weighted randomness', () => {
	it('never calls Math.random and replays the same full deck without duplicates', () => {
		const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unseeded randomness'); });
		try {
			const a = newDeck(createRng(42)), b = newDeck(createRng(42));
			const cards = Array.from({ length: 52 }, () => a.draw());
			expect(cards).toEqual(Array.from({ length: 52 }, () => b.draw()));
			expect(new Set(cards.map(c => `${c.rank}-${c.suit}`)).size).toBe(52);
			expect(a.remaining()).toBe(0);
			expect(() => a.draw()).toThrow('exhausted');
			rollChest('gold', createRng(42));
			resolveRoll(0, createRng(42));
			new SlotMachineGame().play(100, createRng(42));
		} finally { forbidden.mockRestore(); }
	});
	it('preserves sequential pity and natural Supreme at the pity threshold', () => {
		expect(resolveRoll(498, () => 0)).toEqual({ tier: 'Epic', newPity: 499, pityReset: false });
		expect(resolveRoll(499, () => 0)).toEqual({ tier: 'Legendary', newPity: 0, pityReset: true });
		expect(resolveRoll(499, () => 0.999)).toEqual({ tier: 'Supreme', newPity: 0, pityReset: true });
		expect(resolveRoll(400, () => 0.99).newPity).toBe(0);
	});
	it('filters zero weights and implements guaranteed chest rewards', () => {
		for (const n of [0, 0.5, 0.999999]) {
			expect(chance(0, () => n)).toBe(false);
			expect(chance(100, () => n)).toBe(true);
			expect(rollChest('boss_golden', () => n).runeTier).toBe('Legendary');
			expect(rollChest('boss_treasure', () => n).essence).toBe('mythicEssence');
		}
	});
	it('keeps slot blank probability and payout ladder intact', () => {
		const game = new SlotMachineGame();
		const samples = [[0.001, 2000], [0.01, 1000], [0.04, 500], [0.1, 200], [0.3, 150], [0.8, 0]];
		for (const [roll, payout] of samples) expect(game.play(100, () => roll).payout).toBe(payout);
	});
});

describe('casino session replay', () => {
	it('replays Blackjack deterministically and resolves timeout as Stand', () => {
		for (let seed = 1; seed <= 100; seed++) {
			const a = replayGame('blackjack', 100, { seed, actions: ['hit', 'timeout'] });
			const b = replayGame('blackjack', 100, { seed, actions: ['hit', 'stand'] });
			expect(a).toEqual(b);
			expect(a.done).toBe(true);
			expect([0, 100, 200]).toContain(a.payout);
		}
	});
	it('settles an opening natural immediately and hides the dealer while active', () => {
		let active = false, natural = false;
		for (let seed = 1; seed <= 100; seed++) {
			const s = BlackjackSession.create(100, createRng(seed));
			const view = replayGame('blackjack', 100, { seed, actions: [] });
			if (s.state === 'player') { active = true; expect(view.text).toContain('[ẩn]'); }
			else { natural = true; expect(view.done).toBe(true); expect(view.text).not.toContain('[ẩn]'); }
		}
		expect(active && natural).toBe(true);
	});
	it('cannot cash out after crashing; max pushes and timeout resolve safely', () => {
		const s = CrashSession.create(100);
		CrashSession.pushNext(s, () => 0);
		expect(CrashSession.cashOut(s)).toBe(0);
		expect(replayGame('crash', 100, { seed: 42, actions: ['timeout'] }).payout).toBe(100);
		for (let seed = 1; seed <= 100; seed++) {
			const view = replayGame('crash', 100, { seed, actions: Array(10).fill('push') });
			expect(view.done).toBe(true);
		}
	});
});

describe('combat progression', () => {
	const fighter = (name: string) => createCombatant({ name, combatClass: null, hp: 1000, atk: 100, def: 0, crit: 0 });
	it('Aegis blocks one hit only; Warding and Vampiric use fractional seed values', () => {
		const self = fighter('p'), enemy = fighter('e');
		const ctx = { self, enemy, round: 1, rng: () => 0.5, log: () => {} };
		const aegis = new RuneStrategyDecorator(new NullClassStrategy(), 'aegis_rune', 1);
		const first = { reductionFraction: 0 }, second = { reductionFraction: 0 };
		aegis.prepareIncomingHit(ctx, first); aegis.prepareIncomingHit(ctx, second);
		expect(first.reductionFraction).toBe(1); expect(second.reductionFraction).toBe(0);
		const ward = new RuneStrategyDecorator(new NullClassStrategy(), 'warding', 0.15);
		ward.prepareIncomingHit(ctx, second); expect(second.reductionFraction).toBe(0.15);
		self.hp = 500;
		new RuneStrategyDecorator(new NullClassStrategy(), 'vampiric', 0.1).onHitLanded(ctx, { damageDealt: 100, crit: false, triggerExtraAttack: false });
		expect(self.hp).toBe(510);
	});
	it('Bakunawa phases stir below two-thirds HP, Eclipse below half, and ignores stun', () => {
		const self = fighter('Bakunawa'), enemy = fighter('p');
		const strategy = new MonsterStrategy('moon_threshold');
		const ctx = { self, enemy, round: 1, rng: () => 0.5, log: () => {} };
		const hit = () => ({ damagePctBonus: 0, armorPierceFraction: 0, forcedMultiplier: null, suppressCrit: false });
		self.hp = 700; const calm = hit(); strategy.prepareOutgoingHit(ctx, calm); expect(calm.damagePctBonus).toBe(0);
		self.hp = 500; const before = hit(); strategy.prepareOutgoingHit(ctx, before); expect(before.damagePctBonus).toBe(20);
		self.hp = 499; const after = hit(); strategy.prepareOutgoingHit(ctx, after); expect(after.damagePctBonus).toBe(50);
		self.immunityTags = ['stun']; self.debuffs.push({ tag: 'stun', value: 0, turnsLeft: 3 });
		const battle = new BattleEngine().resolve(enemy, self, 42, { enemyStrategy: strategy });
		expect(battle.log.filter(l => l.includes('Bakunawa') && l.includes('không thể'))).toHaveLength(0);
	});
	it('sigils add 5% of base per step, capped at 100% for prestige ascension', () => {
		const base = { atk: 100, hp: 1000, def: 50 };
		expect(computeSigilStats(base, 0)).toEqual({ atk: 50, hp: 500, def: 25 });
		expect(computeSigilStats(base, 1).atk).toBe(55);
		expect(computeSigilStats(base, 10)).toEqual(base);
		expect(computeSigilStats(base, 11)).toEqual(base);
	});
});
