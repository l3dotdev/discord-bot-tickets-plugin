import { defineMessage, okReply } from "@l3dev/discord.js-helpers";
import { ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags } from "discord.js";

import { ButtonCustomId } from "../constants.js";

export const ticketChannelDeleteMessage = defineMessage({
	build: () => {
		const container = new ContainerBuilder();

		container
			.addTextDisplayComponents((textDisplay) =>
				textDisplay.setContent(
					"Are you sure you want to delete this ticket channel? All open ticket threads will be closed and will not be able to be reopened."
				)
			)
			.addActionRowComponents((actionRow) =>
				actionRow.addComponents(
					new ButtonBuilder()
						.setCustomId(ButtonCustomId.DeleteBotTicketChannel)
						.setLabel("Yes, delete this ticket channel")
						.setStyle(ButtonStyle.Danger)
				)
			)
			.addTextDisplayComponents((textDisplay) =>
				textDisplay.setContent("-# Click 'Dismiss message' to cancel")
			);

		return okReply({
			flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
			components: [container]
		});
	}
});
