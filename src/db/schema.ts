// Barrel: tables live in ./tables/<module>.ts grouped by feature module.
// drizzle.config.ts still points here; drizzle-kit follows re-exports.
export * from './tables/identity.js';
export * from './tables/economy.js';
export * from './tables/pve.js';
export * from './tables/pvp.js';
export * from './tables/progression.js';
export * from './tables/meta.js';
export * from './tables/casino.js';
export * from './tables/menu.js';
export * from './tables/system.js';
