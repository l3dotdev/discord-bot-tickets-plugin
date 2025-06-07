import { relations, type InferSelectModel } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

import type { BotTicketFieldType } from "../logic.js";

export type DbBotTicketChannel = InferSelectModel<typeof botTicketChannels>;

export const botTicketChannels = pgTable("bot_ticket_channels", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

	discordChannelId: text("discord_channel_id").notNull(),
	discordChannelMessageId: text("discord_channel_message_id"),

	channelMessageHeading: text("channel_message_heading").notNull(),
	channelMessageDescription: text("channel_message_description").notNull(),

	modalTitle: text("modal_title").notNull(),

	ticketName: text("ticket_name").notNull(),
	ticketDescription: text("ticket_description").notNull(),
	ticketMentions: text("ticket_mentions").array().notNull().default([]),

	limitPerUser: integer("limit_per_user").notNull().default(3),

	updatedAt: timestamp("updated_at")
		.notNull()
		.defaultNow()
		.$onUpdateFn(() => new Date()),
	createdAt: timestamp("created_at").notNull().defaultNow()
});

export const botTicketChannelsRelations = relations(botTicketChannels, ({ many }) => ({
	fields: many(botTicketFields),
	tickets: many(botTickets)
}));

export type DbBotTicketField = InferSelectModel<typeof botTicketFields>;

export const botTicketFields = pgTable(
	"bot_ticket_fields",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

		customId: text("custom_id").notNull(),

		type: text("type").notNull().$type<BotTicketFieldType>(),
		label: text("label").notNull(),
		placeholder: text("placeholder"),
		required: boolean("required").notNull().default(false),

		textMinLength: integer("text_min_length"),
		textMaxLength: integer("text_max_length"),

		updatedAt: timestamp("updated_at")
			.notNull()
			.defaultNow()
			.$onUpdateFn(() => new Date()),
		createdAt: timestamp("created_at").notNull().defaultNow(),

		channelId: integer("channel_id")
			.notNull()
			.references(() => botTicketChannels.id, { onDelete: "cascade" })
	},
	(t) => [unique().on(t.channelId, t.customId)]
);

export const botTicketFieldsRelations = relations(botTicketFields, ({ one, many }) => ({
	channel: one(botTicketChannels, {
		fields: [botTicketFields.channelId],
		references: [botTicketChannels.id]
	}),
	answers: many(botTicketFieldAnswers)
}));

export type DbBotTicketFieldAnswer = InferSelectModel<typeof botTicketFieldAnswers>;
export type DbBotTicketFieldAnswerWithField = DbBotTicketFieldAnswer & { field: DbBotTicketField };

export const botTicketFieldAnswers = pgTable("bot_ticket_field_answers", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

	value: text("value").notNull(),

	ticketId: integer("ticket_id")
		.notNull()
		.references(() => botTickets.id, { onDelete: "cascade" }),
	fieldId: integer("field_id").references(() => botTicketFields.id, { onDelete: "set null" })
});

export const botTicketFieldAnswersRelations = relations(botTicketFieldAnswers, ({ one }) => ({
	ticket: one(botTickets, {
		fields: [botTicketFieldAnswers.ticketId],
		references: [botTickets.id]
	}),
	field: one(botTicketFields, {
		fields: [botTicketFieldAnswers.fieldId],
		references: [botTicketFields.id]
	})
}));

export type DbBotTicket = InferSelectModel<typeof botTickets>;

export const botTickets = pgTable("bot_tickets", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

	openedByDiscordId: text("opened_by_discord_id").notNull(),
	openedByDiscordUsername: text("opened_by_discord_username").notNull(),

	discordThreadId: text("discord_thread_id"),

	closedReason: text("closed_reason"),
	closedByDiscordId: text("closed_by_discord_id"),
	closedByDiscordUsername: text("closed_by_discord_username"),
	closedDiscordMessageId: text("closed_discord_message_id"),
	closedAt: timestamp("closed_at"),

	updatedAt: timestamp("updated_at")
		.notNull()
		.defaultNow()
		.$onUpdateFn(() => new Date()),
	createdAt: timestamp("created_at").notNull().defaultNow(),

	channelId: integer("channel_id")
		.notNull()
		.references(() => botTicketChannels.id, { onDelete: "cascade" })
});

export const botTicketsRelations = relations(botTickets, ({ one, many }) => ({
	channel: one(botTicketChannels, {
		fields: [botTickets.channelId],
		references: [botTicketChannels.id]
	}),
	answers: many(botTicketFieldAnswers)
}));

export const botTicketTables = {
	botTicketChannels,
	botTicketFields,
	botTicketFieldAnswers,
	botTickets
};
