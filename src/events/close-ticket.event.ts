import { defineEventListener } from "@l3dev/discord.js-helpers";
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
import { closeBotTicket } from "../logic.js";
import { errorMessage } from "../messages/error.message.js";

export default defineEventListener({
	event: Events.InteractionCreate,
	listener: async function (interaction) {
		if (
			!interaction.isButton() ||
			![ButtonCustomId.CloseBotTicket, ButtonCustomId.CloseBotTicketWithReason].includes(
				interaction.customId as ButtonCustomId
			)
		) {
			return NONE;
		}

		if (interaction.customId === ButtonCustomId.CloseBotTicket) {
			if (!interaction.channel?.isThread()) {
				return err("EXPECTED_BOT_TICKET_THREAD");
			}

			const closeTicketResult = await closeBotTicket(interaction, interaction.channel);
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
});
