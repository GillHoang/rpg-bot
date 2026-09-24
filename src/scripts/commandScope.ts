import { COMMAND_SCOPE_ERROR_TEXT } from '../shared/ui/text/diagnostics.js';
export interface CommandScope {
	global: boolean;
	guildId: string | null;
}

function readScopeFlags(args: string[], allowAll: boolean) {
	let guildId: string | undefined;
	let global = false;
	let all = false;
	for (let index = 0; index < args.length; index++) {
		const arg = args[index]!;
		if (arg === '--') continue;
		if (arg === '--guild' || arg.startsWith('--guild=')) {
			const value = arg === '--guild' ? args[++index] : arg.slice('--guild='.length);
			guildId = readGuildId(value, guildId);
		} else if (arg === '--global' && !global) {
			global = true;
		} else if (arg === '--all' && allowAll && !all) {
			all = true;
		} else {
			throw new Error(COMMAND_SCOPE_ERROR_TEXT.unknownArgument(arg));
		}
	}
	return { guildId, global, all };
}

function readGuildId(value: string | undefined, previous: string | undefined): string {
	if (previous !== undefined) throw new Error(COMMAND_SCOPE_ERROR_TEXT.repeatedGuild);
	if (!value || !/^\d+$/.test(value)) throw new Error(COMMAND_SCOPE_ERROR_TEXT.guildRequired);
	return value;
}

/** Parse before making any Discord API request. Explicit flags override the environment. */
export function parseCommandScope(args: string[], defaultGuildId?: string, allowAll = false): CommandScope {
	const { guildId, global, all } = readScopeFlags(args, allowAll);
	if (global && (guildId !== undefined || all)) throw new Error(COMMAND_SCOPE_ERROR_TEXT.incompatibleGlobal);
	if (global) return { global: true, guildId: null };
	const resolvedGuild = guildId ?? defaultGuildId;
	if (resolvedGuild !== undefined && !/^\d+$/.test(resolvedGuild))
		throw new Error(COMMAND_SCOPE_ERROR_TEXT.invalidDefaultGuild);
	if (all && !resolvedGuild) throw new Error(COMMAND_SCOPE_ERROR_TEXT.allRequiresGuild);
	return { global: all || resolvedGuild === undefined, guildId: resolvedGuild ?? null };
}
