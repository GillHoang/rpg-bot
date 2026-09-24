import { describe, expect, it } from 'vitest';
import { MenuCapacityError, MenuSessionStore } from '../src/modules/menu/MenuSessionStore.js';

describe('menu session store', () => {
	it('binds independent sessions to their owner and message', () => {
		const store = new MenuSessionStore();
		const a = store.create('alice'),
			b = store.create('alice'),
			c = store.create('bob');
		store.bind(a, 'a');
		store.bind(b, 'b');
		store.bind(c, 'c');
		expect(new Set([a.id, b.id, c.id]).size).toBe(3);
		expect(store.acquire(a.id, 'bob', 'a', 0).status).toBe('forbidden');
		expect(store.acquire(a.id, 'alice', 'b', 0).status).toBe('invalid');
		expect(store.acquire(a.id, 'alice', undefined, 0).status).toBe('invalid');
		expect(store.acquire(a.id, 'alice', 'a', 1).status).toBe('stale');
		expect(store.acquire(a.id, 'alice', 'a', 0).status).toBe('ok');
		expect(store.acquire(a.id, 'alice', 'a', 0).status).toBe('busy');
		expect(store.acquire(b.id, 'alice', 'b', 0).status).toBe('ok');
	});

	it('expires inactive sessions and renews only on explicit activity', () => {
		let now = 0;
		const store = new MenuSessionStore(() => now, 100);
		const a = store.create('a');
		store.bind(a, 'm');
		now = 90;
		store.acquire(a.id, 'a', 'm', 0);
		store.touch(a);
		store.release(a);
		now = 110;
		store.sweep();
		expect(store.acquire(a.id, 'a', 'm', 0).status).toBe('ok');
		store.release(a);
		now = 190;
		expect(store.acquire(a.id, 'a', 'm', 0).status).toBe('expired');
	});

	it('does not evict in-flight work while sweeping or opening another menu', () => {
		let now = 0;
		const store = new MenuSessionStore(() => now, 100, 3, 1);
		const a = store.create('a');
		store.bind(a, 'm');
		store.acquire(a.id, 'a', 'm', 0);
		now = 200;
		store.sweep();
		expect(() => store.create('a')).toThrow(MenuCapacityError);
		expect(store.acquire(a.id, 'a', 'm', 0).status).toBe('busy');
		store.release(a);
		store.sweep();
		expect(store.acquire(a.id, 'a', 'm', 0).status).toBe('expired');
	});

	it('bounds memory and never evicts another user to make space', () => {
		const store = new MenuSessionStore(Date.now, 10000, 2, 1);
		const a = store.create('a');
		store.bind(a, 'a');
		const b = store.create('b');
		store.bind(b, 'b');
		expect(() => store.create('c')).toThrow(MenuCapacityError);
		const replacement = store.create('a');
		store.bind(replacement, 'new');
		expect(store.acquire(a.id, 'a', 'a', 0).status).toBe('expired');
		expect(store.acquire(b.id, 'b', 'b', 0).status).toBe('ok');
	});
});
