import { defineEventListener } from "@l3dev/discord.js-helpers";
import { NONE, Result } from "@l3dev/result";
import { Events, MessageFlags } from "discord.js";

import { ModalCustomId } from "../constants.js";
import { checkOpenThreadPermissionsFlow, openTicketFlow } from "./open-ticket.event.js";
import type { Logic } from "../logic/index.js";
import { errorMessage } from "../messages/error.message.js";

export default function ({ tickets, ticketChannels }: Logic) {
	return {
		default: defineEventListener({
			event: Events.InteractionCreate,
			listener: async function (interaction) {
				const channel = interaction.channel;
				if (
					!interaction.guild ||
					!interaction.inCachedGuild() ||
					!interaction.isModalSubmit() ||
					!interaction.customId.startsWith(ModalCustomId.BotTicketModal) ||
					!channel ||
					channel.isDMBased()
				) {
					return NONE;
				}

				const ticketChannelId = Number(
					interaction.customId.replace(`${ModalCustomId.BotTicketModal}-`, "")
				);
				const ticketChannelResult = await ticketChannels.getChannel(ticketChannelId);
				if (!ticketChannelResult.ok || !ticketChannelResult.value) {
					const replyErrorResult = await Result.fromPromise(
						{ onError: { type: "REPLY_FAILED_TO_FIND_TICKET_CHANNEL" } },
						interaction.reply({
							...errorMessage.build("Failed to find ticket channel").value,
							flags: MessageFlags.Ephemeral
						})
					);
					return Result.all(ticketChannelResult, replyErrorResult);
				}

				const ticketChannel = ticketChannelResult.value;

				const permissionsResult = await checkOpenThreadPermissionsFlow({
					interaction,
					ticketChannels,
					ticketChannel
				});
				if (!permissionsResult.ok) {
					return permissionsResult;
				}

				return await openTicketFlow({ interaction, ticketChannels, ticketChannel, tickets });
			}
		})
	};
}
