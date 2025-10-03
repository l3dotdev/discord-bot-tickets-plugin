import { defineMessage, okReply } from "@l3dev/discord.js-helpers";
import { ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags } from "discord.js";

import { ButtonCustomId } from "../constants.js";

export const closedTicketMessage = defineMessage({
	build: (closedById: string, reason?: string) => {
		const container = new ContainerBuilder();

		container
			.addTextDisplayComponents((textDisplay) =>
				textDisplay.setContent(
					`## :no_entry: Closed\nTicket closed by <@${closedById}>${reason ? `\n### Reason\n${reason}` : ""}`
				)
			)
			.addActionRowComponents((actionRow) =>
				actionRow.addComponents(
					new ButtonBuilder()
						.setCustomId(ButtonCustomId.ReopenBotTicket)
						.setLabel("Reopen ticket")
						.setStyle(ButtonStyle.Primary)
				)
			);

		return okReply({
			flags: MessageFlags.IsComponentsV2,
			components: [container]
		});
	}
});
