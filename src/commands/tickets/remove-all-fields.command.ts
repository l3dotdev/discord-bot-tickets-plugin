import { defineSubcommand } from "@l3dev/discord.js-helpers";
import { logger } from "@l3dev/logger";
import { Result } from "@l3dev/result";
import { MessageFlags } from "discord.js";

import type { Logic } from "../../logic/index.js";
import { errorMessage } from "../../messages/error.message.js";

export default function ({ ticketChannels, ticketFields }: Logic) {
	return {
		default: defineSubcommand({
			name: "remove-all-fields",
			define(builder) {
				return builder
					.setName(this.name)
					.setDescription("Remove all fields from the current ticket channel");
			},
			async execute(interaction) {
				const ticketChannelResult = await ticketChannels.getChannelByDiscordId(
					interaction.channelId
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

				const clearFieldsResult = await ticketFields.clearFields(ticketChannel);
				if (!clearFieldsResult.ok) {
					logger.error("Error removing all ticket channel fields", clearFieldsResult);
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build("Failed to remove all fields from the ticket channel").value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				return await Result.fromPromise(
					interaction.reply({
						content: `:white_check_mark: Successfully removed all fields from the ticket channel`,
						flags: MessageFlags.Ephemeral
					})
				);
			}
		})
	};
}
