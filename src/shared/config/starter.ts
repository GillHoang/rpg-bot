/**
 * Starter constants — ported from config/starter.js. Granted only at
 * character creation (not at registration).
 */
import { WEAPONS_TEXT } from '../ui/text/catalog/weapons.js';
import { ARMORS_TEXT } from '../ui/text/catalog/armors.js';

export const STARTER_WEAPON_NAME = WEAPONS_TEXT['1'].name;
export const STARTER_WEAPON = { atk: 15, crit: 1.0 };

export const STARTER_ARMOR_NAME = ARMORS_TEXT['1'].name;
export const STARTER_ARMOR = { hp: 40, def: 10 };

export const GRANT_BELIEF_SHARDS = 1000;
export const GRANT_SILVER_CHESTS = 10;
