import * as buttonDeleteChannelEvent from "./button-delete-channel.event.js";
import * as closeTicketEvent from "./close-ticket.event.js";
import * as deleteGuildChannelEvent from "./delete-guild-channel.event.js";
import * as openTicketEvent from "./open-ticket.event.js";
import * as reopenTicketEvent from "./reopen-ticket.event.js";
import * as submitCloseTicketEvent from "./submit-close-ticket.event.js";
import * as submitTicketChannelSetupEvent from "./submit-ticket-channel-setup.event.js";
import * as submitTicketEvent from "./submit-ticket.event.js";

export const eventModules = {
	"@l3dev/discord-bot-tickets-plugin/button-delete-channel.event.ts": buttonDeleteChannelEvent,
	"@l3dev/discord-bot-tickets-plugin/close-ticket.event.ts": closeTicketEvent,
	"@l3dev/discord-bot-tickets-plugin/delete-guild-channel.event.ts": deleteGuildChannelEvent,
	"@l3dev/discord-bot-tickets-plugin/open-ticket.event.ts": openTicketEvent,
	"@l3dev/discord-bot-tickets-plugin/reopen-ticket.event.ts": reopenTicketEvent,
	"@l3dev/discord-bot-tickets-plugin/submit-close-ticket.event.ts": submitCloseTicketEvent,
	"@l3dev/discord-bot-tickets-plugin/submit-ticket-channel-setup.event.ts":
		submitTicketChannelSetupEvent,
	"@l3dev/discord-bot-tickets-plugin/submit-ticket.event.ts": submitTicketEvent
};
