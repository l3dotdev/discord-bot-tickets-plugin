import { defineSubcommand } from "@l3dev/discord.js-helpers";
import { logger } from "@l3dev/logger";
import { Result } from "@l3dev/result";
import { MessageFlags } from "discord.js";

import type { Logic } from "../../logic/index.js";
import { errorMessage } from "../../messages/error.message.js";

export default function ({ ticketChannels, ticketFields }: Logic) {
	return {
		default: defineSubcommand({
			name: "remove-field",
			define(builder) {
				return builder
					.setName(this.name)
					.setDescription("Remove a field from the current ticket channel")
					.addStringOption((option) =>
						option.setName("label").setDescription("Name of the field").setRequired(true)
					);
			},
			async execute(interaction) {
				const ticketChannelResult = await ticketChannels.getChannelByDiscordId(
					interaction.channelId
				);
				if (!ticketChannelResult.ok || !ticketChannelResult.value) {
					if (!ticketChannelResult.ok) {
						logger.error("Error getting ticket channel", ticketChannelResult);
					}
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build("Failed to find existing ticket channel").value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				const ticketChannel = ticketChannelResult.value;

				const label = interaction.options.getString("label", true);
				const customId = ticketFields.labelToCustomId(label);

				const fieldResult = await ticketFields.getField(ticketChannel, customId);
				if (!fieldResult.ok) {
					logger.error("Error getting ticket channel field", fieldResult);
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build("Failed to get field from ticket channel").value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				if (!fieldResult.value) {
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build(`Field \`${label}\` does not exist in ticket channel`).value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				const removeFieldResult = await ticketFields.removeField(ticketChannel, customId);
				if (!removeFieldResult.ok) {
					logger.error("Error removing ticket channel field", removeFieldResult);
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build("Failed to remove field from ticket channel").value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				return await Result.fromPromise(
					interaction.reply({
						content: `:white_check_mark: Successfully removed field \`${label}\` from ticket channel`,
						flags: MessageFlags.Ephemeral
					})
				);
			}
		})
	};
}
