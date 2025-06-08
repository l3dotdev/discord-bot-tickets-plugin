import { defineModal, okModal } from "@l3dev/discord.js-helpers";
import { ActionRowBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

import type { DbBotTicketChannel } from "../db-schema/tickets.schema.js";
import { BotTicketSetupModalCustomId, ModalCustomId } from "../ids.js";

export const botTicketSetupModal = defineModal({
	build: (builder, ticketChannel?: DbBotTicketChannel) => {
		const headingInput = new TextInputBuilder()
			.setCustomId(BotTicketSetupModalCustomId.Heading)
			.setLabel("Heading")
			.setStyle(TextInputStyle.Short)
			.setPlaceholder("e.g. Moderation Tickets")
			.setRequired(true)
			.setMinLength(3)
			.setMaxLength(40);

		const descriptionInput = new TextInputBuilder()
			.setCustomId(BotTicketSetupModalCustomId.Description)
			.setLabel("Description")
			.setStyle(TextInputStyle.Paragraph)
			.setPlaceholder("e.g. Please open a ticket by clicking the button above")
			.setRequired(true)
			.setMinLength(35)
			.setMaxLength(1000);

		const modalTitleInput = new TextInputBuilder()
			.setCustomId(BotTicketSetupModalCustomId.ModalTitle)
			.setLabel("Title of ticket form")
			.setStyle(TextInputStyle.Short)
			.setPlaceholder("Title of the modal when clicking 'Open a ticket'")
			.setRequired(true)
			.setMaxLength(50);

		const ticketNameInput = new TextInputBuilder()
			.setCustomId(BotTicketSetupModalCustomId.TicketName)
			.setLabel("Name of a ticket thread")
			.setStyle(TextInputStyle.Short)
			.setPlaceholder("mod-ticket")
			.setRequired(false)
			.setMaxLength(50);

		const ticketDescriptionInput = new TextInputBuilder()
			.setCustomId(BotTicketSetupModalCustomId.TicketDescription)
			.setLabel("Description in ticket thread")
			.setStyle(TextInputStyle.Paragraph)
			.setPlaceholder("Added to the ticket thread message when a ticket is opened")
			.setRequired(false)
			.setMaxLength(1000);

		if (ticketChannel) {
			headingInput.setValue(ticketChannel.channelMessageHeading);
			descriptionInput.setValue(ticketChannel.channelMessageDescription);
			modalTitleInput.setValue(ticketChannel.modalTitle);
			ticketNameInput.setValue(ticketChannel.ticketName);
			ticketDescriptionInput.setValue(ticketChannel.ticketDescription);
		}

		return okModal(
			builder
				.setCustomId(`${ModalCustomId.BotTicketSetupModal}-${Date.now()}`)
				.setTitle(ticketChannel ? "Edit ticket channel" : "Setup ticket channel")
				.addComponents(
					new ActionRowBuilder<TextInputBuilder>().addComponents(headingInput),
					new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
					new ActionRowBuilder<TextInputBuilder>().addComponents(modalTitleInput),
					new ActionRowBuilder<TextInputBuilder>().addComponents(ticketNameInput),
					new ActionRowBuilder<TextInputBuilder>().addComponents(ticketDescriptionInput)
				)
		);
	}
});
