import { db } from './client.js';
import { weaponRoster, armorRoster, mobRoster, deityRoster, runeRoster } from './schema.js';
import { STARTER_WEAPON_NAME, STARTER_ARMOR_NAME } from '../config/starter.js';

/**
 * Minimal roster seed so the ported commands are testable without a real
 * production dataset. NOT the original game's actual content (names,
 * lore, and balance numbers here are placeholders) — replace with real
 * roster exports before going live. Idempotent-ish: re-running will
 * throw on the UNIQUE constraints (deity name) rather than duplicate.
 */
function seed(): void {
	db.insert(weaponRoster)
		.values([
			{
				name: STARTER_WEAPON_NAME,
				type: 'sword',
				tier: 'Rare',
				mythology: 'None',
				passiveKey: 'none',
				passiveName: 'None',
				passiveDescription: 'A plain starter blade.',
			},
			{
				name: "Zeus's Thunderbolt",
				type: 'staff',
				tier: 'Mythic',
				mythology: 'Greek',
				passiveKey: 'none',
				passiveName: 'None',
				passiveDescription: 'Crackles with stored lightning.',
			},
		])
		.run();

	db.insert(armorRoster)
		.values([
			{
				name: STARTER_ARMOR_NAME,
				type: 'light',
				tier: 'Rare',
				mythology: 'None',
				passiveKey: 'none',
				passiveName: 'None',
				passiveDescription: 'Plain starter garb.',
			},
			{
				name: "Athena's Aegis",
				type: 'heavy',
				tier: 'Mythic',
				mythology: 'Greek',
				passiveKey: 'none',
				passiveName: 'None',
				passiveDescription: 'A shield-plate forged for war.',
			},
		])
		.run();

	db.insert(mobRoster)
		.values([
			{
				mobId: 1,
				name: 'Feral Jackal',
				mythology: 'Egyptian',
				mobType: 'regular',
				baseHp: 200,
				baseAtk: 40,
				baseDef: 20,
				baseCrit: 3,
				hpPerLevel: 25,
				atkPerLevel: 4,
				defPerLevel: 2,
				skillKey: 'none',
				skillName: 'None',
				skillDescription: 'No special skill.',
				immunityTags: [],
				specialFlags: {},
			},
			{
				mobId: 2,
				name: 'Restless Wraith',
				mythology: 'Norse',
				mobType: 'regular',
				baseHp: 260,
				baseAtk: 55,
				baseDef: 15,
				baseCrit: 5,
				hpPerLevel: 30,
				atkPerLevel: 5,
				defPerLevel: 1,
				skillKey: 'none',
				skillName: 'None',
				skillDescription: 'No special skill.',
				immunityTags: [],
				specialFlags: {},
			},
		])
		.run();

	db.insert(deityRoster)
		.values([
			{
				name: 'Anubis',
				mythology: 'Egyptian',
				tier: 'Epic',
				baseHp: 150,
				baseAtk: 60,
				baseDef: 30,
				blessingKey: 'none',
				blessingName: 'None',
				blessingDescription: 'A minor blessing, not yet ported.',
				blessingScaling: 'flat',
			},
			{
				name: 'Freyja',
				mythology: 'Norse',
				tier: 'Mythic',
				baseHp: 300,
				baseAtk: 120,
				baseDef: 60,
				blessingKey: 'none',
				blessingName: 'None',
				blessingDescription: 'A greater blessing, not yet ported.',
				blessingScaling: 'flat',
			},
			{
				name: 'Odin',
				mythology: 'Norse',
				tier: 'Legendary',
				baseHp: 600,
				baseAtk: 250,
				baseDef: 120,
				blessingKey: 'none',
				blessingName: 'None',
				blessingDescription: 'An all-father blessing, not yet ported.',
				blessingScaling: 'flat',
			},
			{
				name: 'Zeus',
				mythology: 'Greek',
				tier: 'Supreme',
				baseHp: 1200,
				baseAtk: 500,
				baseDef: 250,
				blessingKey: 'none',
				blessingName: 'None',
				blessingDescription: 'A sovereign blessing, not yet ported.',
				blessingScaling: 'flat',
			},
		])
		.run();

	// Runes have no in-game acquisition path yet (rune-bag/shop is a
	// documented M5 gap) — seeded here only so /socket has something to
	// test against once manually granted to a test user's user_runes row.
	db.insert(runeRoster)
		.values([
			{
				name: 'Rune of Sharpness I',
				lane: 'native',
				effectKey: 'sharpness',
				tier: 'Rare',
				value: 5,
				description: '+5% ATK.',
			},
			{
				name: 'Rune of Vampiric Bite',
				lane: 'opposite',
				effectKey: 'vampiric',
				tier: 'Mythic',
				value: 10,
				description: 'Heal 10% of damage dealt.',
			},
			{
				name: 'Rune of Thorns',
				lane: 'opposite',
				effectKey: 'thorns',
				tier: 'Mythic',
				value: 15,
				description: 'Reflect 15% of damage taken.',
			},
		])
		.run();

	console.log('Seed complete.');
}

seed();
