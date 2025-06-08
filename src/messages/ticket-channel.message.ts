import { defineMessage, okMessage } from "@l3dev/discord.js-helpers";
import { ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags } from "discord.js";

import type { DbBotTicketChannel } from "../db-schema/tickets.schema.js";
import { ButtonCustomId } from "../ids.js";

export const ticketChannelMessage = defineMessage({
	build: (ticketChannel: DbBotTicketChannel) => {
		const container = new ContainerBuilder();

		container.addSectionComponents((section) =>
			section
				.addTextDisplayComponents((textDisplay) =>
					textDisplay.setContent(`# ${ticketChannel.channelMessageHeading}`)
				)
				.setButtonAccessory(
					new ButtonBuilder()
						.setCustomId(`${ButtonCustomId.OpenBotTicket}-${ticketChannel.id}`)
						.setLabel("Open a ticket")
						.setStyle(ButtonStyle.Primary)
				)
		);
		container.addTextDisplayComponents((textDisplay) =>
			textDisplay.setContent(ticketChannel.channelMessageDescription)
		);

		return okMessage({
			flags: MessageFlags.IsComponentsV2,
			components: [container]
		});
	}
});
