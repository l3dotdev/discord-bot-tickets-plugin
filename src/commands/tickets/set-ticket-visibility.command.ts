import { defineSubcommand } from "@l3dev/discord.js-helpers";
import { logger } from "@l3dev/logger";
import { Result } from "@l3dev/result";
import { MessageFlags } from "discord.js";

import type { Logic } from "../../logic/index.js";
import { errorMessage } from "../../messages/error.message.js";

export default function ({ ticketChannels }: Logic) {
	return {
		default: defineSubcommand({
			name: "set-ticket-visibility",
			define(builder) {
				return builder
					.setName(this.name)
					.setDescription("Set whether ticket threads are public or private")
					.addStringOption((option) =>
						option
							.setName("visibility")
							.setDescription("Visibility of the ticket threads")
							.setRequired(true)
							.addChoices(
								{ name: "Public", value: "public" },
								{ name: "Private", value: "private" }
							)
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

				const visibility = interaction.options.getString("visibility", true) as
					| "public"
					| "private";

				const setVisibilityResult = await ticketChannels.setChannelVisibility(
					ticketChannel,
					visibility
				);
				if (!setVisibilityResult.ok) {
					logger.error("Error setting visibility for ticket channel", setVisibilityResult);
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build("Failed to set visibility for the ticket channel").value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				return await Result.fromPromise(
					interaction.reply({
						content: `:white_check_mark: Successfully set visibility of new tickets for the ticket channel to \`${visibility}\``,
						flags: MessageFlags.Ephemeral
					})
				);
			}
		})
	};
}
