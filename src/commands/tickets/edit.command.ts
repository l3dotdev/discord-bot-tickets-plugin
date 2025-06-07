import { defineSubcommand } from "@l3dev/discord.js-helpers";
import { logger } from "@l3dev/logger";
import { NONE, Result } from "@l3dev/result";
import { MessageFlags } from "discord.js";

import { getBotTicketChannelByDiscordId } from "../../logic.js";
import { errorMessage } from "../../messages/error.message.js";
import { botTicketSetupModal } from "../../modals/bot-ticket-setup.modal.js";

export default defineSubcommand({
	name: "edit",
	define(builder) {
		return builder.setName(this.name).setDescription("Edit the current ticket channel");
	},
	async execute(interaction) {
		const ticketChannelResult = await getBotTicketChannelByDiscordId(interaction.channelId);
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

		const modalResult = botTicketSetupModal.build(ticketChannel);

		const showModalResult = await Result.fromPromise(interaction.showModal(modalResult.value));
		if (!showModalResult.ok) return showModalResult;

		return NONE;
	}
});
