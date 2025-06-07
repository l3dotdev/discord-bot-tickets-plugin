import { defineModal, okModal } from "@l3dev/discord.js-helpers";
import { ActionRowBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

import type { DbBotTicketChannel, DbBotTicketField } from "../db/tickets.schema.js";
import { ModalCustomId } from "../ids.js";

export const botTicketModal = defineModal({
	build: (builder, ticketChannel: DbBotTicketChannel, fields: DbBotTicketField[]) => {
		return okModal(
			builder
				.setCustomId(`${ModalCustomId.BotTicketModal}-${ticketChannel.id}`)
				.setTitle(ticketChannel.modalTitle)
				.addComponents(
					fields.map((field) => {
						const textInput = new TextInputBuilder()
							.setCustomId(field.customId)
							.setLabel(field.label)
							.setStyle(field.type === "long" ? TextInputStyle.Paragraph : TextInputStyle.Short)
							.setRequired(field.required);

						if (field.textMinLength) {
							textInput.setMinLength(field.textMinLength);
						}
						if (field.textMaxLength) {
							textInput.setMaxLength(field.textMaxLength);
						}
						if (field.placeholder) {
							textInput.setPlaceholder(field.placeholder);
						}

						return new ActionRowBuilder<TextInputBuilder>().addComponents(textInput);
					})
				)
		);
	}
});
