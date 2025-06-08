import { defineEventListener, iHaveDiscordPermissions } from "@l3dev/discord.js-helpers";
import { err, NONE, Result } from "@l3dev/result";
import {
	ActionRowBuilder,
	Events,
	MessageFlags,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle
} from "discord.js";

import { ButtonCustomId, CloseBotTicketModalCustomId, ModalCustomId } from "../ids.js";
import type { Logic } from "../logic/index.js";
import { errorMessage } from "../messages/error.message.js";

export default function ({ tickets }: Logic) {
	return {
		default: defineEventListener({
			event: Events.InteractionCreate,
			listener: async function (interaction) {
				if (
					!interaction.guild ||
					!interaction.isButton() ||
					![ButtonCustomId.CloseBotTicket, ButtonCustomId.CloseBotTicketWithReason].includes(
						interaction.customId as ButtonCustomId
					)
				) {
					return NONE;
				}

				const channel = interaction.channel;
				if (!channel || !channel.isThread()) {
					return err("EXPECTED_BOT_TICKET_THREAD");
				}

				const permissionsResult = await iHaveDiscordPermissions(
					["ManageThreads", "SendMessagesInThreads"],
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

				if (interaction.customId === ButtonCustomId.CloseBotTicket) {
					const closeTicketResult = await tickets.closeTicket(interaction, channel);
					if (!closeTicketResult.ok) {
						const replyErrorResult = await Result.fromPromise(
							interaction.reply({
								...errorMessage.build("Failed to close ticket, please try again later").value,
								flags: MessageFlags.Ephemeral
							})
						);
						return Result.all(closeTicketResult, replyErrorResult);
					}
					return NONE;
				}

				const modal = new ModalBuilder()
					.setCustomId(ModalCustomId.CloseBotTicketModal)
					.setTitle("Close ticket")
					.addComponents(
						new ActionRowBuilder<TextInputBuilder>().addComponents(
							new TextInputBuilder()
								.setCustomId(CloseBotTicketModalCustomId.Reason)
								.setLabel("Reason")
								.setStyle(TextInputStyle.Short)
								.setRequired(true)
						)
					);

				const showModalResult = await Result.fromPromise(interaction.showModal(modal));
				if (!showModalResult.ok) return showModalResult;

				return NONE;
			}
		})
	};
}
