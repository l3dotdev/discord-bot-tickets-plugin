import { defineEventListener } from "@l3dev/discord.js-helpers";
import { err, NONE, Result } from "@l3dev/result";
import { Events, MessageFlags } from "discord.js";

import { ButtonCustomId } from "../ids.js";
import type { Logic } from "../logic/index.js";
import { errorMessage } from "../messages/error.message.js";

export default function ({ tickets }: Logic) {
	return {
		default: defineEventListener({
			event: Events.InteractionCreate,
			listener: async function (interaction) {
				if (!interaction.isButton() || interaction.customId !== ButtonCustomId.ReopenBotTicket) {
					return NONE;
				}

				if (!interaction.channel?.isThread()) {
					return err("EXPECTED_BOT_TICKET_THREAD");
				}

				const reopenTicketResult = await tickets.reopenTicket(interaction, interaction.channel);
				if (!reopenTicketResult.ok) {
					const replyErrorResult = await Result.fromPromise(
						interaction.reply({
							...errorMessage.build("Failed to reopen ticket, please try again later").value,
							flags: MessageFlags.Ephemeral
						})
					);
					return Result.all(reopenTicketResult, replyErrorResult);
				}

				return NONE;
			}
		})
	};
}
