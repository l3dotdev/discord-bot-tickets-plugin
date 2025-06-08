import { defineSubcommand } from "@l3dev/discord.js-helpers";
import { logger } from "@l3dev/logger";
import { Result } from "@l3dev/result";
import { MessageFlags } from "discord.js";

import type { Logic } from "../../logic/index.js";
import { errorMessage } from "../../messages/error.message.js";

export default function ({ ticketChannels }: Logic) {
	return {
		default: defineSubcommand({
			name: "set-per-user-limit",
			define(builder) {
				return builder
					.setName(this.name)
					.setDescription(
						"Set the maximum number of tickets a user can have open at once in the current ticket channel"
					)
					.addIntegerOption((option) =>
						option
							.setName("limit")
							.setDescription("Limit per user")
							.setRequired(true)
							.setMinValue(1)
					);
			},
			async execute(interaction) {
				if (!interaction.channel || !interaction.channel.isSendable()) {
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build("Run command in a valid channel").value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				const ticketChannelResult = await ticketChannels.getChannelByDiscordId(
					interaction.channel.id
				);
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

				const limit = interaction.options.getInteger("limit", true);

				const setLimitResult = await ticketChannels.setChannelLimitPerUser(ticketChannel, limit);
				if (!setLimitResult.ok) {
					logger.error("Error setting limit per user for ticket channel", setLimitResult);
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build("Failed to set limit per user for the ticket channel").value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				return await Result.fromPromise(
					interaction.reply({
						content: `:white_check_mark: Successfully set limit per user for the ticket channel to \`${limit}\``,
						flags: MessageFlags.Ephemeral
					})
				);
			}
		})
	};
}
