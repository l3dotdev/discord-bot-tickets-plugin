import { getChannel, getMessage } from "@l3dev/discord.js-helpers";
import type { InlineTransaction } from "@l3dev/drizzle-helpers";
import { err, ok, Result } from "@l3dev/result";
import type { Client, ModalSubmitInteraction, TextBasedChannel } from "discord.js";
import { and, eq, isNull } from "drizzle-orm";

import { Repository } from "./repository.js";
import { botTicketTables as tables, type DbBotTicketChannel } from "../db-schema/index.js";
import * as schema from "../db-schema/index.js";
import { BotTicketSetupModalCustomId } from "../constants.js";
import { ticketChannelMessage } from "../messages/ticket-channel.message.js";

export class TicketChannels extends Repository {
	async getChannel(channelId: number) {
		const channelResult = await this.db.safeExecute(
			"BOT_TICKET_CHANNEL_QUERY",
			this.db
				.select()
				.from(tables.botTicketChannels)
				.where(eq(tables.botTicketChannels.id, channelId))
		);
		if (!channelResult.ok) {
			return channelResult;
		}

		return ok(channelResult.value.length ? channelResult.value[0] : null);
	}

	async getChannelByDiscordId(discordChannelId: string) {
		const channelResult = await this.db.safeExecute(
			"BOT_TICKET_CHANNEL_QUERY",
			this.db
				.select()
				.from(tables.botTicketChannels)
				.where(eq(tables.botTicketChannels.discordChannelId, discordChannelId))
		);
		if (!channelResult.ok) {
			return channelResult;
		}

		return ok(channelResult.value.length ? channelResult.value[0] : null);
	}

	async createChannel(interaction: ModalSubmitInteraction, channel: TextBasedChannel) {
		const {
			channelMessageHeading,
			channelMessageDescription,
			modalTitle,
			ticketName,
			ticketDescription
		} = this.extractFields(interaction);

		const tx = await this.db.inlineTransaction();

		const channelResult = await this.db.safeExecute(
			"INSERT_BOT_TICKET_CHANNEL",
			tx
				.insert(tables.botTicketChannels)
				.values({
					discordChannelId: channel.id,
					channelMessageHeading,
					channelMessageDescription,
					modalTitle,
					ticketName,
					ticketDescription,
					limitPerUser: 3
				})
				.returning()
		);
		if (!channelResult.ok) {
			return await tx.rollback(() => channelResult);
		}

		const ticketChannel = channelResult.value[0];

		const messageResult = await this.sendOrReplaceChannelMessage(
			interaction.client,
			ticketChannel,
			tx
		);

		// Transaction is rolled back in sendOrReplaceBotTicketChannelMessage
		if (!messageResult.ok) return messageResult;

		return await tx.commit(() => ok({ ticketChannel }));
	}

	async editChannel(interaction: ModalSubmitInteraction, ticketChannel: DbBotTicketChannel) {
		const {
			channelMessageHeading,
			channelMessageDescription,
			modalTitle,
			ticketName,
			ticketDescription
		} = this.extractFields(interaction);

		const tx = await this.db.inlineTransaction();

		const updateChannelResult = await this.db.safeExecute(
			"UPDATE_BOT_TICKET_CHANNEL",
			tx
				.update(tables.botTicketChannels)
				.set({
					channelMessageHeading,
					channelMessageDescription,
					modalTitle,
					ticketName,
					ticketDescription
				})
				.where(eq(tables.botTicketChannels.id, ticketChannel.id))
				.returning()
		);
		if (!updateChannelResult.ok) {
			return await tx.rollback(() => updateChannelResult);
		}

		const updatedTicketChannel = updateChannelResult.value[0];

		const messageResult = await this.sendOrReplaceChannelMessage(
			interaction.client,
			updatedTicketChannel,
			tx
		);
		// Transaction is rolled back in sendOrReplaceBotTicketChannelMessage
		if (!messageResult.ok) return messageResult;

		return await tx.commit(() => ok({ ticketChannel: updatedTicketChannel }));
	}

	async deleteChannel(client: Client, ticketChannel: DbBotTicketChannel, channelDeleted?: boolean) {
		if (!channelDeleted) {
			const openTicketsResult = await this.db.safeExecute(
				"BOT_TICKET_CHANNEL_OPEN_TICKETS_QUERY",
				this.db
					.select()
					.from(tables.botTickets)
					.where(
						and(
							eq(tables.botTickets.channelId, ticketChannel.id),
							isNull(tables.botTickets.closedAt)
						)
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

		const tx = await this.db.inlineTransaction();

		const channelDeleteResult = await this.db.safeExecute(
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

	async sendOrReplaceChannelMessage(
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

		tx ??= await this.db.inlineTransaction();

		const updateTicketChannelResult = await this.db.safeExecute(
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

	setChannelLimitPerUser(ticketChannel: DbBotTicketChannel, limit: number) {
		return this.db.safeExecute(
			"SET_BOT_TICKET_CHANNEL_LIMIT_PER_USER",
			this.db
				.update(tables.botTicketChannels)
				.set({ limitPerUser: limit })
				.where(eq(tables.botTicketChannels.id, ticketChannel.id))
		);
	}

	setTicketMentions(ticketChannel: DbBotTicketChannel, mentions: string[]) {
		return this.db.safeExecute(
			"SET_BOT_TICKET_CHANNEL_MENTIONS",
			this.db
				.update(tables.botTicketChannels)
				.set({ ticketMentions: mentions })
				.where(eq(tables.botTicketChannels.id, ticketChannel.id))
		);
	}

	private extractFields(interaction: ModalSubmitInteraction) {
		const channelMessageHeading = interaction.fields.getTextInputValue(
			BotTicketSetupModalCustomId.Heading
		);

		const channelMessageDescription = interaction.fields.getTextInputValue(
			BotTicketSetupModalCustomId.Description
		);

		let modalTitle = interaction.fields.getTextInputValue(BotTicketSetupModalCustomId.ModalTitle);
		if (!modalTitle) modalTitle = "Ticket form";

		let ticketName = interaction.fields.getTextInputValue(BotTicketSetupModalCustomId.TicketName);
		if (!ticketName) ticketName = "ticket";
		ticketName = ticketName.trim().toLowerCase().replaceAll(" ", "-");

		const ticketDescription = interaction.fields.getTextInputValue(
			BotTicketSetupModalCustomId.TicketDescription
		);

		return {
			channelMessageHeading,
			channelMessageDescription,
			modalTitle,
			ticketName,
			ticketDescription
		};
	}
}
