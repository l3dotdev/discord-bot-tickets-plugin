import { getChannel, getMessage } from "@l3dev/discord.js-helpers";
import { err, ok, Result } from "@l3dev/result";
import {
	ChannelType,
	MessageFlags,
	ThreadAutoArchiveDuration,
	type ButtonInteraction,
	type ModalSubmitInteraction,
	type PrivateThreadChannel,
	type PublicThreadChannel,
	type User
} from "discord.js";
import { and, count, eq, isNull } from "drizzle-orm";

import { Repository, type Database } from "./repository.js";
import type { TicketFields } from "./ticket-fields.js";
import {
	tables,
	type DbBotTicketChannel,
	type DbBotTicketFieldAnswerWithField
} from "../db-schema/index.js";
import { CloseBotTicketModalCustomId } from "../ids.js";
import { closedTicketMessage } from "../messages/closed-ticket.message.js";
import { ticketDetailsMessage } from "../messages/ticket-details.message.js";

export class Tickets extends Repository {
	constructor(
		db: Database,
		public readonly ticketFields: TicketFields
	) {
		super(db);
	}

	async getTicketByThreadId(threadId: string) {
		const ticketResult = await this.db.safeExecute(
			"BOT_TICKET_QUERY",
			this.db
				.select()
				.from(tables.botTickets)
				.where(eq(tables.botTickets.discordThreadId, threadId))
		);
		if (!ticketResult.ok) {
			return ticketResult;
		}

		return ok(ticketResult.value.length ? ticketResult.value[0] : null);
	}

	async checkTicketLimit(user: User, ticketChannel: DbBotTicketChannel) {
		const activeTicketCountResult = await this.db.safeExecute(
			"BOT_TICKET_COUNT",
			this.db
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

	async createTicket(
		interaction: ModalSubmitInteraction | ButtonInteraction,
		ticketChannel: DbBotTicketChannel
	) {
		const channelResult = await getChannel(interaction.client, ticketChannel.discordChannelId);
		if (!channelResult.ok) return channelResult;

		const channel = channelResult.value;
		if (!channel || channel.type !== ChannelType.GuildText) {
			return err("CHANNEL_CANNOT_HAVE_THREADS");
		}

		const fieldsResult = await this.ticketFields.getChannelFields(ticketChannel.id);
		if (!fieldsResult.ok) {
			return fieldsResult;
		}

		const tx = await this.db.inlineTransaction();

		const ticketResult = await this.db.safeExecute(
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

				const answerResult = await this.db.safeExecute(
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

		const updateTicketResult = await this.db.safeExecute(
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

	async closeTicket(
		interaction: ButtonInteraction | ModalSubmitInteraction,
		thread: PublicThreadChannel<boolean> | PrivateThreadChannel
	) {
		const ticketResult = await this.getTicketByThreadId(thread.id);
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

		const tx = await this.db.inlineTransaction();
		const closeTicketResult = await this.db.safeExecute(
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

	async reopenTicket(
		interaction: ButtonInteraction,
		thread: PublicThreadChannel<boolean> | PrivateThreadChannel
	) {
		const ticketResult = await this.getTicketByThreadId(thread.id);
		if (!ticketResult.ok) {
			return ticketResult;
		}

		const ticket = ticketResult.value;
		if (!ticket) {
			return err("BOT_TICKET_NOT_FOUND");
		}

		const tx = await this.db.inlineTransaction();
		const reopenTicketResult = await this.db.safeExecute(
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
}
