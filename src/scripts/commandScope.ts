export interface CommandScope {
	global: boolean;
	guildId: string | null;
}

/** Parse before making any Discord API request. Explicit flags override the environment. */
export function parseCommandScope(args: string[], defaultGuildId?: string, allowAll = false): CommandScope {
	let guildId: string | undefined;
	let global = false;
	let all = false;
	for (let index = 0; index < args.length; index++) {
		const arg = args[index]!;
		if (arg === '--') continue;
		if (arg === '--guild' || arg.startsWith('--guild=')) {
			if (guildId !== undefined) throw new Error('Specify --guild only once.');
			const value = arg === '--guild' ? args[++index] : arg.slice('--guild='.length);
			if (!value || !/^\d+$/.test(value)) throw new Error('--guild requires a numeric guild ID.');
			guildId = value;
		} else if (arg === '--global' && !global) {
			global = true;
		} else if (arg === '--all' && allowAll && !all) {
			all = true;
		} else {
			throw new Error(`Unknown or repeated argument: ${arg}`);
		}
	}
	if (global && (guildId !== undefined || all)) throw new Error('--global cannot be combined with --guild or --all.');
	if (global) return { global: true, guildId: null };
	const resolvedGuild = guildId ?? defaultGuildId;
	if (resolvedGuild !== undefined && !/^\d+$/.test(resolvedGuild)) throw new Error('Invalid default guild ID.');
	if (all && !resolvedGuild) throw new Error('--all requires --guild <id> or DEPLOY_GUILD_ID.');
	return { global: all || resolvedGuild === undefined, guildId: resolvedGuild ?? null };
}
