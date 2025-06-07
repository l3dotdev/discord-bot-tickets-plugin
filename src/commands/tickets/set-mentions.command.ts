import { defineSubcommand } from "@l3dev/discord.js-helpers";
import { logger } from "@l3dev/logger";
import { Result } from "@l3dev/result";
import { GuildMember, MessageFlags, Role, User } from "discord.js";

import { getBotTicketChannelByDiscordId, setBotTicketChannelMentions } from "../../logic.js";
import { errorMessage } from "../../messages/error.message.js";

export default defineSubcommand({
	name: "set-mentions",
	define(builder) {
		builder
			.setName(this.name)
			.setDescription("Set the users and roles that get added to new tickets");

		for (let i = 0; i < 8; i++) {
			builder.addMentionableOption((option) =>
				option.setName(`mention-${i + 1}`).setDescription("User/Role to add to new tickets")
			);
		}

		return builder;
	},
	async execute(interaction) {
		const ticketChannelResult = await getBotTicketChannelByDiscordId(interaction.channelId);
		if (!ticketChannelResult.ok || !ticketChannelResult.value) {
			if (!ticketChannelResult.ok) {
				logger.error("Error getting ticket channel", ticketChannelResult);
			}
			return await Result.fromPromise(
				interaction.reply({
					...errorMessage.build("Failed to find existing ticket channel").value,
					flags: MessageFlags.Ephemeral
				})
			);
		}

		const ticketChannel = ticketChannelResult.value;

		const mentions: string[] = [];
		for (let i = 0; i < 8; i++) {
			const mention = interaction.options.getMentionable(`mention-${i + 1}`, false);
			if (mention) {
				let mentionString: string;
				if (mention instanceof Role || "color" in mention) {
					mentionString = `<@&${mention.id}>`;
				} else if (mention instanceof User) {
					mentionString = `<@${mention.id}>`;
				} else if (mention instanceof GuildMember) {
					mentionString = `<@${mention.user.id}>`;
				} else {
					continue;
				}

				mentions.push(mentionString);
			}
		}

		const setMentionsResult = await setBotTicketChannelMentions(ticketChannel, mentions);
		if (!setMentionsResult.ok) {
			logger.error("Error setting ticket channel mentions", setMentionsResult);
			return await Result.fromPromise(
				interaction.reply({
					...errorMessage.build("Failed to set mentions for the ticket channel").value,
					flags: MessageFlags.Ephemeral
				})
			);
		}

		return await Result.fromPromise(
			interaction.reply({
				content: `:white_check_mark: Successfully set mentions to \`[${mentions.join(", ")}]\` for the ticket channel`,
				flags: MessageFlags.Ephemeral
			})
		);
	}
});
