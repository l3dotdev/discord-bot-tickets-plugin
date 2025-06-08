import { defineEventListener } from "@l3dev/discord.js-helpers";
import { NONE, Result } from "@l3dev/result";
import { Events, MessageFlags } from "discord.js";

import { ModalCustomId } from "../ids.js";
import type { Logic } from "../logic/index.js";
import { errorMessage } from "../messages/error.message.js";
import { openTicketReplyMessage } from "../messages/open-ticket-reply.message.js";

export default function ({ tickets, ticketChannels }: Logic) {
	return {
		default: defineEventListener({
			event: Events.InteractionCreate,
			listener: async function (interaction) {
				if (
					!interaction.guildId ||
					!interaction.isModalSubmit() ||
					!interaction.customId.startsWith(ModalCustomId.BotTicketModal)
				) {
					return NONE;
				}

				const ticketChannelId = Number(
					interaction.customId.replace(`${ModalCustomId.BotTicketModal}-`, "")
				);
				const ticketChannelResult = await ticketChannels.getChannel(ticketChannelId);
				if (!ticketChannelResult.ok || !ticketChannelResult.value) {
					const replyErrorResult = await Result.fromPromise(
						interaction.reply({
							...errorMessage.build("Failed to find ticket channel").value,
							flags: MessageFlags.Ephemeral
						})
					);
					return Result.all(ticketChannelResult, replyErrorResult);
				}

				const ticketChannel = ticketChannelResult.value;

				const deferResult = await Result.fromPromise(
					interaction.deferReply({
						flags: MessageFlags.Ephemeral
					})
				);
				if (!deferResult.ok) {
					const replyErrorResult = await Result.fromPromise(
						interaction.followUp({
							...errorMessage.build("Failed to respond").value
						})
					);
					return Result.all(deferResult, replyErrorResult);
				}

				const checkTicketLimitResult = await tickets.checkTicketLimit(
					interaction.user,
					ticketChannel
				);
				if (!checkTicketLimitResult.ok) {
					const replyErrorResult = await Result.fromPromise(
						interaction.editReply({
							...errorMessage.build("Failed to create ticket, please try again later").value
						})
					);
					return Result.all(checkTicketLimitResult, replyErrorResult);
				}

				if (!checkTicketLimitResult.value) {
					return await Result.fromPromise(
						{ onError: { type: "REPLY_MAX_ACTIVE_TICKETS_PER_USER" } },
						interaction.editReply({
							content: `You can only have a maximum of ${ticketChannel.limitPerUser} ticket(s) open at once`
						})
					);
				}

				const createTicketResult = await tickets.createTicket(interaction, ticketChannel);
				if (!createTicketResult.ok) {
					const replyErrorResult = await Result.fromPromise(
						interaction.editReply({
							...errorMessage.build("Failed to create ticket, please try again later").value
						})
					);
					return Result.all(createTicketResult, replyErrorResult);
				}

				const { thread } = createTicketResult.value;

				return await Result.fromPromise(
					{ onError: { type: "REPLY_BOT_TICKET_OPENED" } },
					interaction.editReply({
						...openTicketReplyMessage.build(interaction.guildId, thread.id).value
					})
				);
			}
		})
	};
}
