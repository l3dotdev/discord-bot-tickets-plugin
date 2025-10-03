import { defineMessage, okMessage } from "@l3dev/discord.js-helpers";
import {
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	MessageFlags,
	SeparatorSpacingSize
} from "discord.js";

import type {
	DbBotTicketChannel,
	DbBotTicketFieldAnswerWithField
} from "../db-schema/tickets.schema.js";
import { ButtonCustomId } from "../constants.js";

export const ticketDetailsMessage = defineMessage({
	build: (
		ticketId: number,
		userId: string,
		ticketChannel: DbBotTicketChannel,
		answers: DbBotTicketFieldAnswerWithField[]
	) => {
		const container = new ContainerBuilder()
			.addTextDisplayComponents((textDisplay) =>
				textDisplay.setContent(`## Ticket #${ticketId}
<@${userId}> Thank you for opening a ticket!${ticketChannel.ticketDescription ? `\n\n${ticketChannel.ticketDescription}` : ""}${ticketChannel.ticketMentions.length ? `\n\n||${ticketChannel.ticketMentions.join(" ")}||` : ""}`)
			)
			.addSeparatorComponents((separator) =>
				separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small)
			);

		if (answers.length) {
			container
				.addTextDisplayComponents(
					answers.map(
						(answer) => (textDisplay) =>
							textDisplay.setContent(`### ${answer.field.label}\n${answer.value}`)
					)
				)
				.addSeparatorComponents((separator) =>
					separator.setDivider(true).setSpacing(SeparatorSpacingSize.Large)
				);
		}

		container.addActionRowComponents((actionRow) =>
			actionRow.addComponents(
				new ButtonBuilder()
					.setCustomId(ButtonCustomId.CloseBotTicket)
					.setLabel("Close")
					.setStyle(ButtonStyle.Danger),
				new ButtonBuilder()
					.setCustomId(ButtonCustomId.CloseBotTicketWithReason)
					.setLabel("Close with reason")
					.setStyle(ButtonStyle.Danger)
			)
		);

		return okMessage({
			flags: MessageFlags.IsComponentsV2,
			components: [container]
		});
	}
});
