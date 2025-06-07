import { defineEventListener } from "@l3dev/discord.js-helpers";
import { NONE, Result } from "@l3dev/result";
import { Events, MessageFlags } from "discord.js";

import { ButtonCustomId } from "../ids.js";
import {
	checkBotTicketLimit,
	createBotTicket,
	getBotTicketChannel,
	getBotTicketFields
} from "../logic.js";
import { errorMessage } from "../messages/error.message.js";
import { openTicketReplyMessage } from "../messages/open-ticket-reply.message.js";
import { botTicketModal } from "../modals/bot-ticket.modal.js";

export default defineEventListener({
	event: Events.InteractionCreate,
	listener: async function (interaction) {
		if (
			!interaction.guildId ||
			!interaction.isButton() ||
			!interaction.customId.startsWith(ButtonCustomId.OpenBotTicket)
		) {
			return NONE;
		}

		const ticketChannelId = Number(
			interaction.customId.replace(`${ButtonCustomId.OpenBotTicket}-`, "")
		);
		const ticketChannelResult = await getBotTicketChannel(ticketChannelId);
		if (!ticketChannelResult.ok || !ticketChannelResult.value) {
			const replyErrorResult = await Result.fromPromise(
				interaction.reply({
					...errorMessage.build("Failed to get ticket channel data").value,
					flags: MessageFlags.Ephemeral
				})
			);
			return Result.all(ticketChannelResult, replyErrorResult);
		}

		const ticketChannel = ticketChannelResult.value;

		const fieldsResult = await getBotTicketFields(ticketChannel.id);
		if (!fieldsResult.ok) {
			const replyErrorResult = await Result.fromPromise(
				interaction.reply({
					...errorMessage.build("Failed to get ticket modal fields").value,
					flags: MessageFlags.Ephemeral
				})
			);
			return Result.all(fieldsResult, replyErrorResult);
		}

		const fields = fieldsResult.value;
		if (!fields.length) {
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

			const checkTicketLimitResult = await checkBotTicketLimit(interaction.user, ticketChannel);
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

			const createTicketResult = await createBotTicket(interaction, ticketChannel);
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

		const modalResult = botTicketModal.build(ticketChannel, fields);

		const showModalResult = await Result.fromPromise(interaction.showModal(modalResult.value));
		if (!showModalResult.ok) return showModalResult;

		return NONE;
	}
});
