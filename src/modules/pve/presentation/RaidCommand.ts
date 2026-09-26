import { GATES, TIERS_PER_GATE, gateModifiers } from '../../../shared/config/portals.js';
import { GATE_TEXT } from '../../../shared/ui/text/portals.js';
import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { ICommand } from '../../../shared/discord/command.js';
import { sendBattleLog } from '../../../shared/ui/render/BattleLogPager.js';
import { RaidService } from '../application/RaidService.js';
import { NO_CHARACTER, NOT_REGISTERED } from '../../../shared/ui/text/common.js';
import { RAID_FLOW_TEXT, RAID_DESCRIPTION, RAID_NO_MONSTERS_SEEDED } from '../../../shared/ui/text/raid.js';
import { raidBattleOptions } from '../../../shared/ui/render/raidBattleOptions.js';
import { GAMEPLAY_NOTICE } from '../../../shared/ui/text/gameplay.js';
import { RAID_HUNT_COOLDOWN_SECONDS } from '../../../shared/config/raidLoot.js';
import { WEEKLY_MODIFIERS, weeklyModifierAt } from '../../../shared/config/weeklyModifiers.js';

export class RaidCommand implements ICommand {
	readonly data = new SlashCommandBuilder()
		.setName('raid')
		.setDescription(RAID_DESCRIPTION)
		.addSubcommand((s) => s.setName('gates').setDescription(GATE_TEXT.listDescription))
		.addSubcommand((s) =>
			s
				.setName('hunt')
				.setDescription(GATE_TEXT.description)
				.addIntegerOption((o) =>
					o.setName('gate').setDescription(GATE_TEXT.gateOption).setMinValue(1).setMaxValue(GATES.length),
				)
				.addIntegerOption((o) =>
					o.setName('tier').setDescription(GATE_TEXT.tierOption).setMinValue(1).setMaxValue(TIERS_PER_GATE),
				),
		)
		.addSubcommand((s) => s.setName('boss').setDescription(RAID_FLOW_TEXT.bossDescription));

	constructor(private readonly raid: Pick<RaidService, 'run'>) {}

	async execute(interaction: ChatInputCommandInteraction): Promise<void> {
		// Battle + reward grant can exceed the 3s reply window — acknowledge first.
		await interaction.deferReply();
		if (interaction.options.getSubcommand(false) === 'gates') {
			const weekly = WEEKLY_MODIFIERS[weeklyModifierAt(new Date())]!;
			await interaction.editReply(
				GATE_TEXT.weeklyLine(weekly.name, weekly.desc) +
					'\n' +
					GATES.map((g) => GATE_TEXT.gateRowBoss(g.id, g.name, gateModifiers(g), g.minLevel, g.bossLevel)).join('\n') +
					'\n\n' +
					GATE_TEXT.rules,
			);
			return;
		}
		const boss = interaction.options.getSubcommand(false) === 'boss';
		const selection = {
			gate: interaction.options.getInteger('gate') ?? undefined,
			tier: interaction.options.getInteger('tier') ?? undefined,
		};
		const result = await this.raid.run(interaction.user.id, boss, { ...selection, requestId: interaction.id });
		if (result.status === 'already-processed') {
			await interaction.editReply(RAID_FLOW_TEXT.alreadyProcessed);
			return;
		}
		if (result.status === 'boss-locked' || result.status === 'portal-locked') {
			await interaction.editReply(result.message);
			return;
		}
		if (result.status === 'cooldown') {
			await interaction.editReply(
				GAMEPLAY_NOTICE.cooldown(Math.max(1, Math.ceil((result.retryAt.getTime() - Date.now()) / 1000))),
			);
			return;
		}

		if (result.status === 'not-registered') {
			await interaction.editReply({ content: NOT_REGISTERED });
			return;
		}
		if (result.status === 'no-character') {
			await interaction.editReply({ content: NO_CHARACTER });
			return;
		}
		if (result.status === 'no-monsters-seeded') {
			await interaction.editReply({ content: RAID_NO_MONSTERS_SEEDED });
			return;
		}

		const options = raidBattleOptions(result, boss, interaction.user.username);
		if (!boss) {
			// Replay sticks to the requested gate but drops the tier number after a
			// win so the next replay targets the default (just-unlocked) tier instead
			// of farming the same cleared tier forever.
			const replaySelection = { ...selection };
			if (result.battle.outcome === 'player_win') replaySelection.tier = undefined;
			options.replay = {
				ownerId: interaction.user.id,
				cooldownMs: RAID_HUNT_COOLDOWN_SECONDS * 1000,
				run: async (requestId) => {
					const next = await this.raid.run(interaction.user.id, false, { ...replaySelection, requestId });
					if (next.status === 'ok') {
						if (replaySelection.tier !== undefined && next.battle.outcome === 'player_win') {
							// won the explicitly selected tier — advance to the default (next) tier
							replaySelection.tier = undefined;
						}
						return raidBattleOptions(next, false, interaction.user.username);
					}
					if (next.status === 'cooldown')
						return GAMEPLAY_NOTICE.cooldown(
							Math.max(1, Math.ceil((next.retryAt.getTime() - Date.now()) / 1000)),
						);
					if (next.status === 'not-registered') return NOT_REGISTERED;
					if (next.status === 'no-character') return NO_CHARACTER;
					if (next.status === 'no-monsters-seeded') return RAID_NO_MONSTERS_SEEDED;
					if (next.status === 'boss-locked' || next.status === 'portal-locked') return next.message;
					return RAID_FLOW_TEXT.alreadyProcessed;
				},
			};
		}
		await sendBattleLog(interaction, options, 'edit');
	}
}
