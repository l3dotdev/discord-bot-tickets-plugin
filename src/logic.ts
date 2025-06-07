import { getChannel, getMessage } from "@l3dev/discord.js-helpers";
import type { InlineTransaction, WrappedDrizzle } from "@l3dev/drizzle-helpers";
import { err, ok, Result } from "@l3dev/result";
import {
	ChannelType,
	Client,
	MessageFlags,
	ThreadAutoArchiveDuration,
	User,
	type ButtonInteraction,
	type ModalSubmitInteraction,
	type PrivateThreadChannel,
	type PublicThreadChannel,
	type TextBasedChannel
} from "discord.js";
import { and, count, eq, isNull } from "drizzle-orm";

import { botTicketTables as tables } from "./db/tickets.schema.js";
import type * as schema from "./db/tickets.schema.js";
import type { DbBotTicketChannel, DbBotTicketFieldAnswerWithField } from "./db/tickets.schema.js";
import { BotTicketSetupModalCustomId, CloseBotTicketModalCustomId } from "./ids.js";
import { closedTicketMessage } from "./messages/closed-ticket.message.js";
import { ticketChannelMessage } from "./messages/ticket-channel.message.js";
import { ticketDetailsMessage } from "./messages/ticket-details.message.js";

export enum BotTicketFieldType {
	Short = "short",
	Long = "long"
}

export const BotTicketFieldTypeNames = {
	short: "Short",
	long: "Long"
} satisfies Record<BotTicketFieldType, string>;

export const BotTicketFieldTypeChoices = (
	Object.keys(BotTicketFieldTypeNames) as BotTicketFieldType[]
).map((key) => ({
	name: BotTicketFieldTypeNames[key],
	value: key
}));

let db: WrappedDrizzle<typeof schema>;

export function setDatabase(newDb: WrappedDrizzle<typeof schema>) {
	db = newDb;
}

export async function getBotTicketChannel(channelId: number) {
	const channelResult = await db.safeExecute(
		"BOT_TICKET_CHANNEL_QUERY",
		db.select().from(tables.botTicketChannels).where(eq(tables.botTicketChannels.id, channelId))
	);
	if (!channelResult.ok) {
		return channelResult;
	}

	return ok(channelResult.value.length ? channelResult.value[0] : null);
}

export async function getBotTicketChannelByDiscordId(discordChannelId: string) {
	const channelResult = await db.safeExecute(
		"BOT_TICKET_CHANNEL_QUERY",
		db
			.select()
			.from(tables.botTicketChannels)
			.where(eq(tables.botTicketChannels.discordChannelId, discordChannelId))
	);
	if (!channelResult.ok) {
		return channelResult;
	}

	return ok(channelResult.value.length ? channelResult.value[0] : null);
}

export async function createBotTicketChannel(
	interaction: ModalSubmitInteraction,
	channel: TextBasedChannel
) {
	const tx = await db.inlineTransaction();

	const channelResult = await db.safeExecute(
		"INSERT_BOT_TICKET_CHANNEL",
		tx
			.insert(tables.botTicketChannels)
			.values({
				discordChannelId: channel.id,
				channelMessageHeading: interaction.fields.getTextInputValue(
					BotTicketSetupModalCustomId.Heading
				),
				channelMessageDescription: interaction.fields.getTextInputValue(
					BotTicketSetupModalCustomId.Description
				),
				modalTitle: interaction.fields.getTextInputValue(BotTicketSetupModalCustomId.ModalTitle),
				ticketName: interaction.fields
					.getTextInputValue(BotTicketSetupModalCustomId.TicketName)
					.trim()
					.toLowerCase()
					.replaceAll(" ", "-"),
				ticketDescription: interaction.fields.getTextInputValue(
					BotTicketSetupModalCustomId.TicketDescription
				),
				limitPerUser: 3
			})
			.returning()
	);
	if (!channelResult.ok) {
		return await tx.rollback(() => channelResult);
	}

	const ticketChannel = channelResult.value[0];

	const messageResult = await sendOrReplaceBotTicketChannelMessage(
		interaction.client,
		ticketChannel,
		tx
	);

	// Transaction is rolled back in sendOrReplaceBotTicketChannelMessage
	if (!messageResult.ok) return messageResult;

	return await tx.commit(() => ok({ ticketChannel }));
}

export async function editBotTicketChannel(
	interaction: ModalSubmitInteraction,
	ticketChannel: DbBotTicketChannel
) {
	const tx = await db.inlineTransaction();

	const updateChannelResult = await db.safeExecute(
		"UPDATE_BOT_TICKET_CHANNEL",
		tx
			.update(tables.botTicketChannels)
			.set({
				channelMessageHeading: interaction.fields.getTextInputValue(
					BotTicketSetupModalCustomId.Heading
				),
				channelMessageDescription: interaction.fields.getTextInputValue(
					BotTicketSetupModalCustomId.Description
				),
				modalTitle: interaction.fields.getTextInputValue(BotTicketSetupModalCustomId.ModalTitle),
				ticketName: interaction.fields
					.getTextInputValue(BotTicketSetupModalCustomId.TicketName)
					.trim()
					.toLowerCase()
					.replaceAll(" ", "-"),
				ticketDescription: interaction.fields.getTextInputValue(
					BotTicketSetupModalCustomId.TicketDescription
				)
			})
			.where(eq(tables.botTicketChannels.id, ticketChannel.id))
			.returning()
	);
	if (!updateChannelResult.ok) {
		return await tx.rollback(() => updateChannelResult);
	}

	const updatedTicketChannel = updateChannelResult.value[0];

	const messageResult = await sendOrReplaceBotTicketChannelMessage(
		interaction.client,
		updatedTicketChannel,
		tx
	);
	// Transaction is rolled back in sendOrReplaceBotTicketChannelMessage
	if (!messageResult.ok) return messageResult;

	return await tx.commit(() => ok({ ticketChannel: updatedTicketChannel }));
}

export async function deleteBotTicketChannel(
	client: Client,
	ticketChannel: DbBotTicketChannel,
	channelDeleted?: boolean
) {
	if (!channelDeleted) {
		const openTicketsResult = await db.safeExecute(
			"BOT_TICKET_CHANNEL_OPEN_TICKETS_QUERY",
			db
				.select()
				.from(tables.botTickets)
				.where(
					and(eq(tables.botTickets.channelId, ticketChannel.id), isNull(tables.botTickets.closedAt))
				)
		);
		if (!openTicketsResult.ok) return openTicketsResult;

		const openTickets = openTicketsResult.value;
		for (const ticket of openTickets) {
			if (!ticket.discordThreadId) continue;

			const threadResult = await getChannel(client, ticket.discordThreadId);
			if (!threadResult.ok) return threadResult;

			const thread = threadResult.value;
			if (!thread || !thread.isThread()) continue;

			const closeThreadResult = await Result.fromPromise(
				{ onError: { type: "CLOSE_BOT_TICKET_THREAD" } },
				thread.setArchived(true, `Delete ticket channel`)
			);
			if (!closeThreadResult.ok) return closeThreadResult;
		}
	}

	const tx = await db.inlineTransaction();

	const channelDeleteResult = await db.safeExecute(
		"DELETE_BOT_TICKET_CHANNEL",
		tx.delete(tables.botTicketChannels).where(eq(tables.botTicketChannels.id, ticketChannel.id))
	);
	if (!channelDeleteResult.ok) {
		return await tx.rollback(() => channelDeleteResult);
	}

	if (!channelDeleted) {
		const channelResult = await getChannel(client, ticketChannel.discordChannelId);
		if (!channelResult.ok) return channelResult;

		const channel = channelResult.value;
		if (channel && channel.isTextBased()) {
			const messageResult = ticketChannel.discordChannelMessageId
				? await getMessage(channel, ticketChannel.discordChannelMessageId)
				: ok(null);
			if (!messageResult.ok) return messageResult;

			const message = messageResult.value;

			if (message) {
				const deleteMessageResult = await Result.fromPromise(
					{ onError: { type: "DELETE_BOT_TICKET_CHANNEL_MESSAGE" } },
					message.delete()
				);
				if (!deleteMessageResult.ok) {
					return await tx.rollback(() => deleteMessageResult);
				}
			}
		}
	}

	return await tx.commit(() => ok({ ticketChannel }));
}

export async function sendOrReplaceBotTicketChannelMessage(
	client: Client,
	ticketChannel: DbBotTicketChannel,
	tx?: InlineTransaction<typeof schema>
) {
	const channelResult = await getChannel(client, ticketChannel.discordChannelId);
	if (!channelResult.ok) return channelResult;

	const channel = channelResult.value;
	if (!channel || !channel.isSendable()) {
		return err("CANNOT_SEND_MESSAGE_TO_CHANNEL");
	}

	const messageResult = ticketChannel.discordChannelMessageId
		? await getMessage(channel, ticketChannel.discordChannelMessageId)
		: ok(null);
	if (!messageResult.ok) return messageResult;

	const message = messageResult.value;

	if (message) {
		const deleteMessageResult = await Result.fromPromise(
			{ onError: { type: "DELETE_BOT_TICKET_CHANNEL_MESSAGE" } },
			message.delete()
		);
		if (!deleteMessageResult.ok) return deleteMessageResult;
	}

	const sendMessageResult = await Result.fromPromise(
		{ onError: { type: "SEND_BOT_TICKET_CHANNEL_MESSAGE" } },
		channel.send(ticketChannelMessage.build(ticketChannel).value)
	);
	if (!sendMessageResult.ok) return sendMessageResult;

	const newMessage = sendMessageResult.value;

	tx ??= await db.inlineTransaction();

	const updateTicketChannelResult = await db.safeExecute(
		"UPDATE_BOT_TICKET_CHANNEL_WITH_MESSAGE",
		tx
			.update(tables.botTicketChannels)
			.set({ discordChannelMessageId: newMessage.id })
			.where(eq(tables.botTicketChannels.id, ticketChannel.id))
	);
	if (!updateTicketChannelResult.ok) {
		return await tx.rollback(async () => {
			await newMessage.delete();
			return updateTicketChannelResult;
		});
	}

	return await tx.commit(() => updateTicketChannelResult);
}

export function setBotTicketChannelLimitPerUser(ticketChannel: DbBotTicketChannel, limit: number) {
	return db.safeExecute(
		"SET_BOT_TICKET_CHANNEL_LIMIT_PER_USER",
		db
			.update(tables.botTicketChannels)
			.set({ limitPerUser: limit })
			.where(eq(tables.botTicketChannels.id, ticketChannel.id))
	);
}

export function setBotTicketChannelMentions(ticketChannel: DbBotTicketChannel, mentions: string[]) {
	return db.safeExecute(
		"SET_BOT_TICKET_CHANNEL_MENTIONS",
		db
			.update(tables.botTicketChannels)
			.set({ ticketMentions: mentions })
			.where(eq(tables.botTicketChannels.id, ticketChannel.id))
	);
}

export function getBotTicketFields(channelId: number) {
	return db.safeExecute(
		"BOT_TICKET_FIELDS_FIELDS",
		db.select().from(tables.botTicketFields).where(eq(tables.botTicketFields.channelId, channelId))
	);
}

export async function getBotTicketByThreadId(threadId: string) {
	const ticketResult = await db.safeExecute(
		"BOT_TICKET_QUERY",
		db.select().from(tables.botTickets).where(eq(tables.botTickets.discordThreadId, threadId))
	);
	if (!ticketResult.ok) {
		return ticketResult;
	}

	return ok(ticketResult.value.length ? ticketResult.value[0] : null);
}

export function botTicketFieldLabelToCustomId(label: string) {
	return label.toLowerCase().trim().replaceAll(" ", "-");
}

export async function getBotTicketField(ticketChannel: DbBotTicketChannel, customId: string) {
	const fieldResult = await db.safeExecute(
		"BOT_TICKET_FIELD_QUERY",
		db
			.select()
			.from(tables.botTicketFields)
			.where(
				and(
					eq(tables.botTicketFields.channelId, ticketChannel.id),
					eq(tables.botTicketFields.customId, customId)
				)
			)
	);
	if (!fieldResult.ok) {
		return fieldResult;
	}

	return ok(fieldResult.value.length ? fieldResult.value[0] : null);
}

export async function getBotTicketChannelFieldCount(ticketChannel: DbBotTicketChannel) {
	const fieldCountResult = await db.safeExecute(
		"BOT_TICKET_CHANNEL_FIELD_COUNT",
		db
			.select({ count: count() })
			.from(tables.botTicketFields)
			.where(eq(tables.botTicketFields.channelId, ticketChannel.id))
	);
	if (!fieldCountResult.ok) {
		return fieldCountResult;
	}

	return ok(fieldCountResult.value[0].count);
}

type AddBotTicketFieldInput = {
	label: string;
	type: BotTicketFieldType;
	placeholder?: string | null;
	required?: boolean | null;
	textMinLength?: number | null;
	textMaxLength?: number | null;
};

export function addBotTicketField(
	ticketChannel: DbBotTicketChannel,
	input: AddBotTicketFieldInput
) {
	return db.safeExecute(
		"ADD_BOT_TICKET_FIELD",
		db.insert(tables.botTicketFields).values({
			channelId: ticketChannel.id,
			customId: botTicketFieldLabelToCustomId(input.label),
			label: input.label,
			type: input.type,
			placeholder: input.placeholder,
			required: input.required ?? false,
			textMinLength: input.textMinLength,
			textMaxLength: input.textMaxLength
		})
	);
}

export function removeBotTicketField(ticketChannel: DbBotTicketChannel, customId: string) {
	return db.safeExecute(
		"REMOVE_BOT_TICKET_FIELD",
		db
			.delete(tables.botTicketFields)
			.where(
				and(
					eq(tables.botTicketFields.channelId, ticketChannel.id),
					eq(tables.botTicketFields.customId, customId)
				)
			)
	);
}

export function clearBotTicketFields(ticketChannel: DbBotTicketChannel) {
	return db.safeExecute(
		"REMOVE_ALL_BOT_TICKET_FIELDS",
		db.delete(tables.botTicketFields).where(eq(tables.botTicketFields.channelId, ticketChannel.id))
	);
}

export async function checkBotTicketLimit(user: User, ticketChannel: DbBotTicketChannel) {
	const activeTicketCountResult = await db.safeExecute(
		"BOT_TICKET_COUNT",
		db
			.select({ count: count() })
			.from(tables.botTickets)
			.where(
				and(
					eq(tables.botTickets.channelId, ticketChannel.id),
					eq(tables.botTickets.openedByDiscordId, user.id),
					isNull(tables.botTickets.closedAt)
				)
			)
	);
	if (!activeTicketCountResult.ok) {
		return activeTicketCountResult;
	}

	return ok(activeTicketCountResult.value[0].count < ticketChannel.limitPerUser);
}

export async function createBotTicket(
	interaction: ModalSubmitInteraction | ButtonInteraction,
	ticketChannel: DbBotTicketChannel
) {
	const channelResult = await getChannel(interaction.client, ticketChannel.discordChannelId);
	if (!channelResult.ok) return channelResult;

	const channel = channelResult.value;
	if (!channel || channel.type !== ChannelType.GuildText) {
		return err("CHANNEL_CANNOT_HAVE_THREADS");
	}

	const fieldsResult = await getBotTicketFields(ticketChannel.id);
	if (!fieldsResult.ok) {
		return fieldsResult;
	}

	const tx = await db.inlineTransaction();

	const ticketResult = await db.safeExecute(
		"INSERT_BOT_TICKET",
		tx
			.insert(tables.botTickets)
			.values({
				channelId: ticketChannel.id,
				openedByDiscordId: interaction.user.id,
				openedByDiscordUsername: interaction.user.username
			})
			.returning({
				id: tables.botTickets.id
			})
	);
	if (!ticketResult.ok) {
		return await tx.rollback(() => ticketResult);
	}

	const ticket = ticketResult.value[0];

	const fields = fieldsResult.value;
	const answers: DbBotTicketFieldAnswerWithField[] = [];
	if (interaction.isModalSubmit()) {
		for (const field of fields) {
			const answerValue = interaction.fields.getTextInputValue(field.customId);

			const answerResult = await db.safeExecute(
				"INSERT_BOT_TICKET_ANSWER",
				tx
					.insert(tables.botTicketFieldAnswers)
					.values({
						value: answerValue,
						ticketId: ticket.id,
						fieldId: field.id
					})
					.returning()
			);
			if (!answerResult.ok) {
				return await tx.rollback(() => answerResult);
			}

			const answer = answerResult.value[0];
			answers.push({
				...answer,
				field
			});
		}
	}

	const createThreadResult = await Result.fromPromise(
		{ onError: { type: "CREATE_BOT_TICKET_THREAD" } },
		channel.threads.create({
			type: ChannelType.PrivateThread,
			name: `${ticketChannel.ticketName ? ticketChannel.ticketName : "ticket"}-${ticket.id}`,
			reason: `Create ticket thread for ticket ${ticket.id}`,
			autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
			invitable: false
		})
	);
	if (!createThreadResult.ok) {
		return await tx.rollback(() => createThreadResult);
	}

	const thread = createThreadResult.value;

	const updateTicketResult = await db.safeExecute(
		"UPDATE_BOT_TICKET_WITH_THREAD",
		tx
			.update(tables.botTickets)
			.set({ discordThreadId: thread.id })
			.where(eq(tables.botTickets.id, ticket.id))
	);
	if (!updateTicketResult.ok) {
		return await tx.rollback(async () => {
			await thread.delete();
			return updateTicketResult;
		});
	}

	const sendStartMessageResult = await Result.fromPromise(
		thread.send({
			...ticketDetailsMessage.build(ticket.id, interaction.user.id, ticketChannel, answers).value
		})
	);
	if (!sendStartMessageResult.ok) {
		return await tx.rollback(async () => {
			await thread.delete();
			return sendStartMessageResult;
		});
	}

	const addUserResult = await Result.fromPromise(
		{ onError: { type: "ADD_USER_TO_THREAD" } },
		thread.members.add(interaction.user.id)
	);
	if (!addUserResult.ok) {
		return await tx.rollback(async () => {
			await thread.delete();
			return addUserResult;
		});
	}

	return await tx.commit(() => ok({ ticket, thread }));
}

export async function closeBotTicket(
	interaction: ButtonInteraction | ModalSubmitInteraction,
	thread: PublicThreadChannel<boolean> | PrivateThreadChannel
) {
	const ticketResult = await getBotTicketByThreadId(thread.id);
	if (!ticketResult.ok) {
		return ticketResult;
	}

	const ticket = ticketResult.value;
	if (!ticket) {
		return err("BOT_TICKET_NOT_FOUND");
	}

	if (ticket.closedAt) {
		return await Result.fromPromise(
			{ onError: { type: "REPLY_ALREADY_CLOSED_BOT_TICKET" } },
			interaction.reply({
				flags: MessageFlags.Ephemeral,
				content: "This ticket has already been closed"
			})
		);
	}

	let reason: string | null = null;
	if (interaction.isModalSubmit()) {
		reason = interaction.fields.getTextInputValue(CloseBotTicketModalCustomId.Reason);
	}

	const sendCloseMessageResult = await Result.fromPromise(
		{ onError: { type: "REPLY_CLOSED_BOT_TICKET" } },
		interaction.reply({
			...closedTicketMessage.build(interaction.user.id, reason ?? undefined).value
		})
	);
	if (!sendCloseMessageResult.ok) {
		return sendCloseMessageResult;
	}

	const closeMessageResult = await Result.fromPromise(interaction.fetchReply());
	if (!closeMessageResult.ok) {
		return closeMessageResult;
	}

	const closeMessage = closeMessageResult.value;

	const tx = await db.inlineTransaction();
	const closeTicketResult = await db.safeExecute(
		"CLOSE_BOT_TICKET",
		tx
			.update(tables.botTickets)
			.set({
				closedReason: reason,
				closedByDiscordId: interaction.user.id,
				closedByDiscordUsername: interaction.user.username,
				closedDiscordMessageId: closeMessage.id,
				closedAt: new Date()
			})
			.where(eq(tables.botTickets.discordThreadId, thread.id))
	);
	if (!closeTicketResult.ok) {
		return await tx.rollback(async () => {
			await closeMessage.delete();
			return closeTicketResult;
		});
	}

	const closeThreadResult = await Result.fromPromise(
		{ onError: { type: "CLOSE_BOT_TICKET_THREAD" } },
		thread.setArchived(true, `<@${interaction.user.id}> closed ticket`)
	);
	if (!closeThreadResult.ok) {
		return await tx.rollback(async () => {
			await closeMessage.delete();
			return closeThreadResult;
		});
	}

	return await tx.commit(() => closeTicketResult);
}

export async function reopenBotTicket(
	interaction: ButtonInteraction,
	thread: PublicThreadChannel<boolean> | PrivateThreadChannel
) {
	const ticketResult = await getBotTicketByThreadId(thread.id);
	if (!ticketResult.ok) {
		return ticketResult;
	}

	const ticket = ticketResult.value;
	if (!ticket) {
		return err("BOT_TICKET_NOT_FOUND");
	}

	const tx = await db.inlineTransaction();
	const reopenTicketResult = await db.safeExecute(
		"REOPEN_BOT_TICKET",
		tx
			.update(tables.botTickets)
			.set({
				closedReason: null,
				closedByDiscordId: null,
				closedByDiscordUsername: null,
				closedDiscordMessageId: null,
				closedAt: null
			})
			.where(eq(tables.botTickets.id, ticket.id))
	);
	if (!reopenTicketResult.ok) {
		return await tx.rollback(() => reopenTicketResult);
	}

	if (ticket.closedDiscordMessageId) {
		const getCloseMessageResult = await getMessage(thread, ticket.closedDiscordMessageId);
		if (getCloseMessageResult.ok && getCloseMessageResult.value) {
			const closeMessage = getCloseMessageResult.value;

			const deleteCloseMessageResult = await Result.fromPromise(
				{ onError: { type: "DELETE_CLOSE_BOT_TICKET_MESSAGE" } },
				closeMessage.delete()
			);
			if (!deleteCloseMessageResult.ok) {
				return await tx.rollback(() => deleteCloseMessageResult);
			}
		}
	}

	const openThreadResult = await Result.fromPromise(
		{ onError: { type: "OPEN_BOT_TICKET_THREAD" } },
		thread.setArchived(false, `<@${interaction.user.id}> reopened ticket`)
	);
	if (!openThreadResult.ok) {
		return await tx.rollback(() => openThreadResult);
	}

	const sendReopenMessageResult = await Result.fromPromise(
		{ onError: { type: "REPLY_REOPEN_BOT_TICKET" } },
		interaction.reply({
			content: `<@${interaction.user.id}> reopened the ticket`
		})
	);
	if (!sendReopenMessageResult.ok) {
		return await tx.rollback(async () => {
			thread.setArchived(true, "Rollback 'Reopen ticket'");
			return sendReopenMessageResult;
		});
	}

	return await tx.commit(() => reopenTicketResult);
}
