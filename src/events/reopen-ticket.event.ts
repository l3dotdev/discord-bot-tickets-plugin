import { defineEventListener, iHaveDiscordPermissions } from "@l3dev/discord.js-helpers";
import { err, NONE, Result } from "@l3dev/result";
import { Events, MessageFlags } from "discord.js";

import { ButtonCustomId } from "../constants.js";
import type { Logic } from "../logic/index.js";
import { errorMessage } from "../messages/error.message.js";

export default function ({ tickets }: Logic) {
	return {
		default: defineEventListener({
			event: Events.InteractionCreate,
			listener: async function (interaction) {
				if (
					!interaction.guild ||
					!interaction.isButton() ||
					interaction.customId !== ButtonCustomId.ReopenBotTicket
				) {
					return NONE;
				}

				const channel = interaction.channel;
				if (!channel || !channel.isThread()) {
					return err("EXPECTED_BOT_TICKET_THREAD");
				}

				const permissionsResult = await iHaveDiscordPermissions(
					["ManageThreads", "SendMessagesInThreads"],
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

				const reopenTicketResult = await tickets.reopenTicket(interaction, channel);
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
