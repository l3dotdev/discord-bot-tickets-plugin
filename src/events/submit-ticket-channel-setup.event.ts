import { defineEventListener } from "@l3dev/discord.js-helpers";
import { NONE, Result } from "@l3dev/result";
import { Events, MessageFlags } from "discord.js";

import { ModalCustomId } from "../ids.js";
import {
	createBotTicketChannel,
	editBotTicketChannel,
	getBotTicketChannelByDiscordId
} from "../logic.js";
import { errorMessage } from "../messages/error.message.js";

export default defineEventListener({
	event: Events.InteractionCreate,
	listener: async function (interaction) {
		if (
			!interaction.isModalSubmit() ||
			!interaction.customId.startsWith(ModalCustomId.BotTicketSetupModal) ||
			!interaction.channel
		) {
			return NONE;
		}

		const ticketChannelResult = await getBotTicketChannelByDiscordId(interaction.channel.id);
		if (!ticketChannelResult.ok) {
			const replyErrorResult = await Result.fromPromise(
				interaction.reply({
					...errorMessage.build("Failed to check for existing ticket channel").value,
					flags: MessageFlags.Ephemeral
				})
			);
			return Result.all(ticketChannelResult, replyErrorResult);
		}

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

		const ticketChannel = ticketChannelResult.value;
		if (ticketChannel) {
			const editTicketChannelResult = await editBotTicketChannel(interaction, ticketChannel);
			if (!editTicketChannelResult.ok) {
				const replyErrorResult = await Result.fromPromise(
					interaction.editReply({
						...errorMessage.build("Failed to edit ticket channel").value
					})
				);
				return Result.all(editTicketChannelResult, replyErrorResult);
			}

			return await Result.fromPromise(
				interaction.editReply({
					content: ":white_check_mark: Successfully edited ticket channel"
				})
			);
		}

		const createTicketChannelResult = await createBotTicketChannel(
			interaction,
			interaction.channel
		);
		if (!createTicketChannelResult.ok) {
			const replyErrorResult = await Result.fromPromise(
				interaction.editReply({
					...errorMessage.build("Failed to create ticket channel").value
				})
			);
			return Result.all(createTicketChannelResult, replyErrorResult);
		}

		return await Result.fromPromise(
			interaction.editReply({
				content: ":white_check_mark: Successfully created ticket channel"
			})
		);
	}
});
