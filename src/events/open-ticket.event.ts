import {
	defineEventListener,
	hasDiscordPermissions,
	iHaveDiscordPermissions
} from "@l3dev/discord.js-helpers";
import { NONE, Result } from "@l3dev/result";
import type { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import { Events, MessageFlags } from "discord.js";

import { ButtonCustomId } from "../constants.js";
import type { DbBotTicketChannel } from "../db-schema/tickets.schema.js";
import type { Logic, TicketChannels, Tickets } from "../logic/index.js";
import { errorMessage } from "../messages/error.message.js";
import { openTicketReplyMessage } from "../messages/open-ticket-reply.message.js";
import { botTicketModal } from "../modals/bot-ticket.modal.js";

export async function checkOpenThreadPermissionsFlow({
	interaction,
	ticketChannels,
	ticketChannel
}: {
	interaction: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">;
	ticketChannels: TicketChannels;
	ticketChannel: DbBotTicketChannel;
}) {
	const permissionsResult = await iHaveDiscordPermissions(
		[
			"ManageThreads",
			"SendMessagesInThreads",
			ticketChannels.getChannelThreadsPermission(ticketChannel)
		],
		{
			guild: interaction.guild,
			channel: interaction.channel
		}
	);
	if (!permissionsResult.ok) {
		if (permissionsResult.type === "MISSING_PERMISSIONS") {
			const missingPermissions = permissionsResult.context.missingPermissions
				.map((p) => `\`${p}\``)
				.join(", ");
			return await Result.fromPromise(
				{ onError: { type: "REPLY_MISSING_PERMISSIONS" } },
				interaction.reply({
					...errorMessage.build(`Missing permissions: ${missingPermissions}`).value,
					flags: MessageFlags.Ephemeral
				})
			);
		}
		return await Result.fromPromise(
			{ onError: { type: "REPLY_FAILED_TO_CHECK_PERMISSIONS" } },
			interaction.reply({
				...errorMessage.build("Failed to check permissions").value,
				flags: MessageFlags.Ephemeral
			})
		);
	}

	return NONE;
}

export async function openTicketFlow({
	interaction,
	ticketChannels,
	ticketChannel,
	tickets
}: {
	interaction: ButtonInteraction<"cached"> | ModalSubmitInteraction<"cached">;
	ticketChannels: TicketChannels;
	ticketChannel: DbBotTicketChannel;
	tickets: Tickets;
}) {
	const deferResult = await Result.fromPromise(
		interaction.deferReply({
			flags: MessageFlags.Ephemeral
		})
	);
	if (!deferResult.ok) {
		const replyErrorResult = await Result.fromPromise(
			{ onError: { type: "REPLY_FAILED_TO_DEFER" } },
			interaction.followUp({
				...errorMessage.build("Failed to respond").value
			})
		);
		return Result.all(deferResult, replyErrorResult);
	}

	const checkTicketLimitResult = await tickets.checkTicketLimit(interaction.user, ticketChannel);
	if (!checkTicketLimitResult.ok) {
		const replyErrorResult = await Result.fromPromise(
			{ onError: { type: "REPLY_FAILED_TO_CHECK_TICKET_LIMIT" } },
			interaction.editReply({
				...errorMessage.build("Failed to create ticket, please try again later").value
			})
		);
		return Result.all(checkTicketLimitResult, replyErrorResult);
	}

	let followUp = false;
	if (checkTicketLimitResult.value.exceeded) {
		const threadLinks = checkTicketLimitResult.value.threadIds
			.map((threadId) => `https://discord.com/channels/${interaction.guildId}/${threadId}`)
			.join(", ");

		const hasThreadsPermission = await hasDiscordPermissions(
			interaction.member,
			[ticketChannels.getChannelThreadsPermission(ticketChannel)],
			{
				guild: interaction.guild,
				channel: interaction.channel
			}
		);
		if (hasThreadsPermission.ok) {
			const suggestionResult = await Result.fromPromise(
				{ onError: { type: "REPLY_MAX_ACTIVE_TICKETS_PER_USER_SUGGESTION" } },
				interaction.editReply({
					content: `You have more than ${ticketChannel.limitPerUser} open ticket(s), you may want to close some before opening more. You're open tickets: ${threadLinks}`
				})
			);

			if (!suggestionResult.ok) {
				return suggestionResult;
			}

			followUp = true;
		} else if (hasThreadsPermission.type === "MISSING_PERMISSIONS") {
			return await Result.fromPromise(
				{ onError: { type: "REPLY_MAX_ACTIVE_TICKETS_PER_USER" } },
				interaction.editReply({
					content: `You can only have a maximum of ${ticketChannel.limitPerUser} ticket(s) open at once. You're open tickets: ${threadLinks}`
				})
			);
		} else {
			return hasThreadsPermission;
		}
	}

	const createTicketResult = await tickets.createTicket(interaction, ticketChannel);
	if (!createTicketResult.ok) {
		const content = errorMessage.build("Failed to create ticket, please try again later").value;
		const replyErrorResult = await Result.fromPromise(
			{ onError: { type: "REPLY_FAILED_TO_CREATE_TICKET" } },
			followUp ? interaction.followUp({ ...content }) : interaction.editReply({ ...content })
		);
		return Result.all(createTicketResult, replyErrorResult);
	}

	const { thread } = createTicketResult.value;
	const content = openTicketReplyMessage.build(interaction.guild.id, thread.id).value;

	return await Result.fromPromise(
		{ onError: { type: "REPLY_BOT_TICKET_OPENED" } },
		followUp ? interaction.followUp({ ...content }) : interaction.editReply({ ...content })
	);
}

export default function ({ ticketChannels, ticketFields, tickets }: Logic) {
	return {
		default: defineEventListener({
			event: Events.InteractionCreate,
			listener: async function (interaction) {
				const channel = interaction.channel;
				if (
					!interaction.guild ||
					!interaction.inCachedGuild() ||
					!interaction.isButton() ||
					!interaction.customId.startsWith(ButtonCustomId.OpenBotTicket) ||
					!channel ||
					channel.isDMBased()
				) {
					return NONE;
				}

				const ticketChannelId = Number(
					interaction.customId.replace(`${ButtonCustomId.OpenBotTicket}-`, "")
				);
				const ticketChannelResult = await ticketChannels.getChannel(ticketChannelId);
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

				const permissionsResult = await checkOpenThreadPermissionsFlow({
					interaction,
					ticketChannels,
					ticketChannel
				});
				if (!permissionsResult.ok) {
					return permissionsResult;
				}

				const fieldsResult = await ticketFields.getChannelFields(ticketChannel.id);
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
					return await openTicketFlow({ interaction, ticketChannels, ticketChannel, tickets });
				}

				const modalResult = botTicketModal.build(ticketChannel, fields);

				const showModalResult = await Result.fromPromise(interaction.showModal(modalResult.value));
				if (!showModalResult.ok) return showModalResult;

				return NONE;
			}
		})
	};
}
