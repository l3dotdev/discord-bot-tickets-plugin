import { defineSubcommand, iHaveDiscordPermissions } from "@l3dev/discord.js-helpers";
import { logger } from "@l3dev/logger";
import { NONE, Result } from "@l3dev/result";
import { MessageFlags } from "discord.js";

import type { Logic } from "../../logic/index.js";
import { errorMessage } from "../../messages/error.message.js";
import { ticketChannelDeleteMessage } from "../../messages/ticket-channel-delete.message.js";

export default function ({ ticketChannels }: Logic) {
	return {
		default: defineSubcommand({
			name: "delete",
			define(builder) {
				return builder.setName(this.name).setDescription("Delete the current ticket channel");
			},
			async execute(interaction) {
				const channel = interaction.channel;
				if (!interaction.guild || !channel || channel.isDMBased()) {
					return NONE;
				}

				const permissionsResult = await iHaveDiscordPermissions(["ManageThreads"], {
					guild: interaction.guild,
					channel
				});
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

				const sendResult = await Result.fromPromise(
					{ onError: { type: "REPLY_DELETE_TICKET_CHANNEL" } },
					interaction.reply({
						...ticketChannelDeleteMessage.build().value
					})
				);
				if (!sendResult.ok) {
					logger.error("Error sending ticket channel delete message", sendResult);
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build("Failed to send the delete confirmation message").value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				return NONE;
			}
		})
	};
}
