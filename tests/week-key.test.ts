import { expect, it } from 'vitest';
import { weekWindowAt } from '../src/config/ranked.js';

it('includes ISO week year, including December/January boundaries', () => {
	expect(weekWindowAt(new Date('2021-01-01T00:00:00Z')).key).toBe('2020-W53');
	expect(weekWindowAt(new Date('2024-12-30T00:00:00Z')).key).toBe('2025-W01');
	expect(weekWindowAt(new Date('2026-01-01T00:00:00Z')).key).toBe('2026-W01');
	expect(weekWindowAt(new Date('2027-01-04T00:00:00Z')).key).toBe('2027-W01');
});
