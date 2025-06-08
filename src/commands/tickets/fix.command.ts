import { defineSubcommand } from "@l3dev/discord.js-helpers";
import { logger } from "@l3dev/logger";
import { Result } from "@l3dev/result";
import { MessageFlags } from "discord.js";

import type { Logic } from "../../logic/index.js";
import { errorMessage } from "../../messages/error.message.js";

export default function ({ ticketChannels }: Logic) {
	return {
		default: defineSubcommand({
			name: "fix",
			define(builder) {
				return builder
					.setName(this.name)
					.setDescription("Fix the channel message of the current ticket channel");
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

				const sendResult = await ticketChannels.sendOrReplaceChannelMessage(
					interaction.client,
					ticketChannel
				);
				if (!sendResult.ok) {
					logger.error("Error sending ticket channel message", sendResult);
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build("Failed to send the channel message").value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				return await Result.fromPromise(
					interaction.reply({
						content: ":white_check_mark: Successfully reposted the channel message",
						flags: MessageFlags.Ephemeral
					})
				);
			}
		})
	};
}
