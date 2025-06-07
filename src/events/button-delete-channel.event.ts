import { defineEventListener } from "@l3dev/discord.js-helpers";
import { NONE, Result } from "@l3dev/result";
import { Events, MessageFlags } from "discord.js";

import { ButtonCustomId } from "../ids.js";
import { deleteBotTicketChannel, getBotTicketChannelByDiscordId } from "../logic.js";
import { errorMessage } from "../messages/error.message.js";

export default defineEventListener({
	event: Events.InteractionCreate,
	listener: async function (interaction) {
		if (
			!interaction.isButton() ||
			interaction.customId !== ButtonCustomId.DeleteBotTicketChannel ||
			!interaction.channel
		) {
			return NONE;
		}

		const ticketChannelResult = await getBotTicketChannelByDiscordId(interaction.channel.id);
		if (!ticketChannelResult.ok || !ticketChannelResult.value) {
			const replyErrorResult = await Result.fromPromise(
				interaction.reply({
					...errorMessage.build("Failed to find existing ticket channel").value,
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

		const deleteChannelResult = await deleteBotTicketChannel(interaction.client, ticketChannel);
		if (!deleteChannelResult.ok) {
			const replyErrorResult = await Result.fromPromise(
				interaction.editReply({
					...errorMessage.build("Failed to delete ticket channel").value
				})
			);
			return Result.all(deleteChannelResult, replyErrorResult);
		}

		return await Result.fromPromise(
			interaction.editReply({
				content: ":white_check_mark: Successfully deleted ticket channel"
			})
		);
	}
});
