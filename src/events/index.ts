import * as buttonDeleteChannelEvent from "./button-delete-channel.event.js";
import * as closeTicketEvent from "./close-ticket.event.js";
import * as deleteGuildChannelEvent from "./delete-guild-channel.event.js";
import * as openTicketEvent from "./open-ticket.event.js";
import * as reopenTicketEvent from "./reopen-ticket.event.js";
import * as submitCloseTicketEvent from "./submit-close-ticket.event.js";
import * as submitTicketChannelSetupEvent from "./submit-ticket-channel-setup.event.js";
import * as submitTicketEvent from "./submit-ticket.event.js";

export const eventModules = {
	"button-delete-channel.event.ts": buttonDeleteChannelEvent,
	"close-ticket.event.ts": closeTicketEvent,
	"delete-guild-channel.event.ts": deleteGuildChannelEvent,
	"open-ticket.event.ts": openTicketEvent,
	"reopen-ticket.event.ts": reopenTicketEvent,
	"submit-close-ticket.event.ts": submitCloseTicketEvent,
	"submit-ticket-channel-setup.event.ts": submitTicketChannelSetupEvent,
	"submit-ticket.event.ts": submitTicketEvent
};
