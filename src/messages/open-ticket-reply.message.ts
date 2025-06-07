import { defineMessage, okReply } from "@l3dev/discord.js-helpers";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export const openTicketReplyMessage = defineMessage({
	build: (guildId: string, threadId: string) => {
		return okReply({
			content:
				"Thank you for opening a ticket! Please add any additional information and screenshots here:",
			components: [
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder()
						.setLabel("Go to ticket")
						.setStyle(ButtonStyle.Link)
						.setURL(`https://discord.com/channels/${guildId}/${threadId}`)
				)
			]
		});
	}
});
