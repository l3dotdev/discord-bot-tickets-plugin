import { defineSubcommand, iHaveDiscordPermissions } from "@l3dev/discord.js-helpers";
import { logger } from "@l3dev/logger";
import { NONE, Result } from "@l3dev/result";
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
				const channel = interaction.channel;
				if (!interaction.guild || !channel || channel.isDMBased() || !channel.isSendable()) {
					return NONE;
				}

				const permissionsResult = await iHaveDiscordPermissions(
					["SendMessages", "ManageThreads", "CreatePrivateThreads", "SendMessagesInThreads"],
					{
						guild: interaction.guild,
						channel
					}
				);
				if (!permissionsResult.ok) {
					if (permissionsResult.type === "MISSING_PERMISSIONS") {
						const missingPermissions = permissionsResult.context.missingPermissions
							.map((p) => `\`${p}\``)
							.join(", ");
						return await Result.fromPromise(
							interaction.reply({
								...errorMessage.build(`Missing permissions: ${missingPermissions}`).value,
								flags: MessageFlags.Ephemeral
							})
						);
					}
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build("Failed to check permissions").value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				const ticketChannelResult = await ticketChannels.getChannelByDiscordId(channel.id);
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
