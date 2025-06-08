import { ok } from "@l3dev/result";
import { and, count, eq } from "drizzle-orm";

import { Repository } from "./repository.js";
import { tables, type DbBotTicketChannel } from "../db-schema/index.js";

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

type AddBotTicketFieldInput = {
	label: string;
	type: BotTicketFieldType;
	placeholder?: string | null;
	required?: boolean | null;
	textMinLength?: number | null;
	textMaxLength?: number | null;
};

export class TicketFields extends Repository {
	labelToCustomId(label: string) {
		return label.toLowerCase().trim().replaceAll(" ", "-");
	}

	getChannelFields(channelId: number) {
		return this.db.safeExecute(
			"BOT_TICKET_FIELDS_FIELDS",
			this.db
				.select()
				.from(tables.botTicketFields)
				.where(eq(tables.botTicketFields.channelId, channelId))
		);
	}

	async getField(ticketChannel: DbBotTicketChannel, customId: string) {
		const fieldResult = await this.db.safeExecute(
			"BOT_TICKET_FIELD_QUERY",
			this.db
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

	async getChannelFieldCount(ticketChannel: DbBotTicketChannel) {
		const fieldCountResult = await this.db.safeExecute(
			"BOT_TICKET_CHANNEL_FIELD_COUNT",
			this.db
				.select({ count: count() })
				.from(tables.botTicketFields)
				.where(eq(tables.botTicketFields.channelId, ticketChannel.id))
		);
		if (!fieldCountResult.ok) {
			return fieldCountResult;
		}

		return ok(fieldCountResult.value[0].count);
	}

	addField(ticketChannel: DbBotTicketChannel, input: AddBotTicketFieldInput) {
		return this.db.safeExecute(
			"ADD_BOT_TICKET_FIELD",
			this.db.insert(tables.botTicketFields).values({
				channelId: ticketChannel.id,
				customId: this.labelToCustomId(input.label),
				label: input.label,
				type: input.type,
				placeholder: input.placeholder,
				required: input.required ?? false,
				textMinLength: input.textMinLength,
				textMaxLength: input.textMaxLength
			})
		);
	}

	removeField(ticketChannel: DbBotTicketChannel, customId: string) {
		return this.db.safeExecute(
			"REMOVE_BOT_TICKET_FIELD",
			this.db
				.delete(tables.botTicketFields)
				.where(
					and(
						eq(tables.botTicketFields.channelId, ticketChannel.id),
						eq(tables.botTicketFields.customId, customId)
					)
				)
		);
	}

	clearFields(ticketChannel: DbBotTicketChannel) {
		return this.db.safeExecute(
			"REMOVE_ALL_BOT_TICKET_FIELDS",
			this.db
				.delete(tables.botTicketFields)
				.where(eq(tables.botTicketFields.channelId, ticketChannel.id))
		);
	}
}
