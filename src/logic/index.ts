import type { TicketChannels } from "./ticket-channels.js";
import type { TicketFields } from "./ticket-fields.js";
import type { Tickets } from "./ticket.js";

export * from "./ticket-channels.js";
export * from "./ticket-fields.js";
export * from "./ticket.js";

export type Logic = {
	ticketChannels: TicketChannels;
	ticketFields: TicketFields;
	tickets: Tickets;
};
