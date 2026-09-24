/**
 * Discord adapter layer: command contract + registry.
 * This is the only shared scope allowed to depend on `discord.js`.
 */
export type { ICommand } from './command.js';
export { CommandRegistry } from '../../app/CommandRegistry.js';
