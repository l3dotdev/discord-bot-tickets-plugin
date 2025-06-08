import { defineEventListener } from "@l3dev/discord.js-helpers";
import { err, NONE, Result } from "@l3dev/result";
import { Events, MessageFlags } from "discord.js";

import { ModalCustomId } from "../ids.js";
import type { Logic } from "../logic/index.js";
import { errorMessage } from "../messages/error.message.js";

export default function ({ tickets }: Logic) {
	return {
		default: defineEventListener({
			event: Events.InteractionCreate,
			listener: async function (interaction) {
				if (
					!interaction.isModalSubmit() ||
					interaction.customId !== ModalCustomId.CloseBotTicketModal
				) {
					return NONE;
				}

				if (!interaction.channel?.isThread()) {
					return err("EXPECTED_BOT_TICKET_THREAD");
				}

				const closeTicketResult = await tickets.closeTicket(interaction, interaction.channel);
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
		})
	};
}
