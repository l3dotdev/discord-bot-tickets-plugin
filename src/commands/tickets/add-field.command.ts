import { defineSubcommand } from "@l3dev/discord.js-helpers";
import { logger } from "@l3dev/logger";
import { Result } from "@l3dev/result";
import { MessageFlags } from "discord.js";

import { BotTicketFieldType, BotTicketFieldTypeChoices, type Logic } from "../../logic/index.js";
import { errorMessage } from "../../messages/error.message.js";

export default function ({ ticketChannels, ticketFields }: Logic) {
	return {
		default: defineSubcommand({
			name: "add-field",
			define(builder) {
				return builder
					.setName(this.name)
					.setDescription("Add a field to the current ticket channel")
					.addStringOption((option) =>
						option
							.setName("label")
							.setDescription("Name of the field")
							.setMaxLength(50)
							.setRequired(true)
					)
					.addStringOption((option) =>
						option
							.setName("type")
							.setDescription("The type of field")
							.setRequired(true)
							.addChoices(...BotTicketFieldTypeChoices)
					)
					.addStringOption((option) =>
						option
							.setName("placeholder")
							.setDescription("Placeholder value for the field")
							.setMaxLength(100)
					)
					.addBooleanOption((option) =>
						option.setName("required").setDescription("Whether the field is required")
					)
					.addIntegerOption((option) =>
						option.setName("min_length").setDescription("Minimum length of the user's input")
					)
					.addIntegerOption((option) =>
						option.setName("max_length").setDescription("Maximum length of the user's input")
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

				const fieldCountResult = await ticketFields.getChannelFieldCount(ticketChannel);
				if (!fieldCountResult.ok) {
					logger.error("Error getting ticket channel field count", fieldCountResult);
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build("Failed to count number of existing fields in ticket channel")
								.value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				if (fieldCountResult.value >= 5) {
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build(
								"You can only have a maximum of 5 fields in a ticket channel, use `/tickets remove-field` to remove a field"
							).value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				const label = interaction.options.getString("label", true);
				const addFieldResult = await ticketFields.addField(ticketChannel, {
					label,
					type: interaction.options.getString("type", true) as BotTicketFieldType,
					placeholder: interaction.options.getString("placeholder"),
					required: interaction.options.getBoolean("required"),
					textMinLength: interaction.options.getInteger("min_length"),
					textMaxLength: interaction.options.getInteger("max_length")
				});

				if (!addFieldResult.ok) {
					logger.error("Error adding ticket channel field", addFieldResult);
					return await Result.fromPromise(
						interaction.reply({
							...errorMessage.build("Failed to add field to ticket channel").value,
							flags: MessageFlags.Ephemeral
						})
					);
				}

				return await Result.fromPromise(
					interaction.reply({
						content: `:white_check_mark: Successfully added field \`${label}\` to ticket channel`,
						flags: MessageFlags.Ephemeral
					})
				);
			}
		})
	};
}
