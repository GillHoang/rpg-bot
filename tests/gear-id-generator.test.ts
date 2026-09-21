import { describe, expect, it, vi } from 'vitest';
import type { Executor } from '../src/db/client.js';
import { GearIdGenerator } from '../src/utils/idGenerator.js';

// Only identity is relevant to these port tests; no database operation may be performed on the handle.
const executor = Object.freeze({}) as Executor;

describe('GearIdGenerator identity boundary', () => {
	it('checks weapon, armor and ticket collisions in order on the caller executor', async () => {
		const hasWeapon = vi.fn(async (_tx: Executor, id: string) => id === 'weapon');
		const hasArmor = vi.fn(async (_tx: Executor, id: string) => id === 'armor');
		const hasTicket = vi.fn(async (_tx: Executor, id: string) => id === 'ticket');
		const createId = vi
			.fn<() => string>()
			.mockReturnValueOnce('weapon')
			.mockReturnValueOnce('armor')
			.mockReturnValueOnce('ticket')
			.mockReturnValueOnce('free');
		const generator = new GearIdGenerator(executor, { hasWeapon, hasArmor, hasTicket }, createId);
		await expect(generator.generateUniqueGearId()).resolves.toBe('free');
		expect(hasWeapon.mock.calls).toEqual([
			[executor, 'weapon'],
			[executor, 'armor'],
			[executor, 'ticket'],
			[executor, 'free'],
		]);
		expect(hasArmor.mock.calls).toEqual([
			[executor, 'armor'],
			[executor, 'ticket'],
			[executor, 'free'],
		]);
		expect(hasTicket.mock.calls).toEqual([
			[executor, 'ticket'],
			[executor, 'free'],
		]);
		expect(hasWeapon.mock.invocationCallOrder[3]).toBeLessThan(hasArmor.mock.invocationCallOrder[2]);
		expect(hasArmor.mock.invocationCallOrder[2]).toBeLessThan(hasTicket.mock.invocationCallOrder[1]);
	});

	it('stops after exactly ten collisions and skips unnecessary queries', async () => {
		const hasWeapon = vi.fn(async () => true);
		const hasArmor = vi.fn(async () => false);
		const hasTicket = vi.fn(async () => false);
		const createId = vi.fn(() => 'occupied');
		const generator = new GearIdGenerator(executor, { hasWeapon, hasArmor, hasTicket }, createId);
		await expect(generator.generateUniqueGearId()).rejects.toThrow(
			'Failed to generate a unique gear id after 10 attempts',
		);
		expect(createId).toHaveBeenCalledTimes(10);
		expect(hasWeapon).toHaveBeenCalledTimes(10);
		expect(hasArmor).not.toHaveBeenCalled();
		expect(hasTicket).not.toHaveBeenCalled();
	});

	it('propagates persistence failure without treating it as a collision or retrying', async () => {
		const failure = new Error('identity query failed');
		const hasWeapon = vi.fn().mockRejectedValue(failure);
		const hasArmor = vi.fn(async () => false);
		const hasTicket = vi.fn(async () => false);
		const createId = vi.fn(() => 'candidate');
		const generator = new GearIdGenerator(executor, { hasWeapon, hasArmor, hasTicket }, createId);
		await expect(generator.generateUniqueGearId()).rejects.toBe(failure);
		expect(createId).toHaveBeenCalledTimes(1);
		expect(hasArmor).not.toHaveBeenCalled();
		expect(hasTicket).not.toHaveBeenCalled();
	});

	it('retains the eight-character lowercase alphanumeric crypto-generated format', async () => {
		const identity = { hasWeapon: async () => false, hasArmor: async () => false, hasTicket: async () => false };
		await expect(new GearIdGenerator(executor, identity).generateUniqueGearId()).resolves.toMatch(/^[0-9a-z]{8}$/);
	});
});
