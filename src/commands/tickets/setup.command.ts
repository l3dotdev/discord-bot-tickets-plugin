import { defineSubcommand, iHaveDiscordPermissions } from "@l3dev/discord.js-helpers";
import { logger } from "@l3dev/logger";
import { NONE, Result } from "@l3dev/result";
import { MessageFlags } from "discord.js";

import type { Logic } from "../../logic/index.js";
import { errorMessage } from "../../messages/error.message.js";
import { botTicketSetupModal } from "../../modals/bot-ticket-setup.modal.js";

export default function ({ ticketChannels }: Logic) {
	return {
		default: defineSubcommand({
			name: "setup",
			define(builder) {
				return builder
					.setName(this.name)
					.setDescription("Make the current channel a ticket channel");
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
				if (!ticketChannelResult.ok) {
					logger.error("Error getting ticket channel", ticketChannelResult);
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build("Failed to check for existing ticket channel").value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				if (ticketChannelResult.value) {
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build(
								"This is already a ticket channel, if the channel message is missing run `/tickets fix`"
							).value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				const modalResult = botTicketSetupModal.build();

				const showModalResult = await Result.fromPromise(interaction.showModal(modalResult.value));
				if (!showModalResult.ok) return showModalResult;

				return NONE;
			}
		})
	};
}
