import { defineEventListener, iHaveDiscordPermissions } from "@l3dev/discord.js-helpers";
import { NONE, Result } from "@l3dev/result";
import { Events, MessageFlags } from "discord.js";

import { ModalCustomId } from "../ids.js";
import type { Logic } from "../logic/index.js";
import { errorMessage } from "../messages/error.message.js";

export default function ({ ticketChannels }: Logic) {
	return {
		default: defineEventListener({
			event: Events.InteractionCreate,
			listener: async function (interaction) {
				const channel = interaction.channel;
				if (
					!interaction.guild ||
					!interaction.isModalSubmit() ||
					!interaction.customId.startsWith(ModalCustomId.BotTicketSetupModal) ||
					!channel ||
					channel.isDMBased()
				) {
					return NONE;
				}

				const permissionsResult = await iHaveDiscordPermissions(
					["SendMessages", "ManageThreads", "CreatePrivateThreads", "SendMessagesInThreads"],
					{
						guild: interaction.guild,
						channel
					}
				);
				if (!permissionsResult.ok) {
					if (permissionsResult.type === "MISSING_PERMISSIONS") {
						const missingPermissions = permissionsResult.context.missingPermissions
							.map((p) => `\`${p}\``)
							.join(", ");
						return await Result.fromPromise(
							interaction.reply({
								...errorMessage.build(`Missing permissions: ${missingPermissions}`).value,
								flags: MessageFlags.Ephemeral
							})
						);
					}
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build("Failed to check permissions").value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				const ticketChannelResult = await ticketChannels.getChannelByDiscordId(channel.id);
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
					const editTicketChannelResult = await ticketChannels.editChannel(
						interaction,
						ticketChannel
					);
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

				const createTicketChannelResult = await ticketChannels.createChannel(interaction, channel);
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
		})
	};
}
