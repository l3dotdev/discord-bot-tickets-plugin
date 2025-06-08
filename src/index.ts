import { definePlugin } from "@l3dev/discord.js-helpers";

import { getCommandModules } from "./commands/index.js";
import { PLUGIN_NAME } from "./constants.js";
import { getEventListenerModules } from "./events/index.js";
import type { Database } from "./logic/repository.js";
import { TicketChannels } from "./logic/ticket-channels.js";
import { TicketFields } from "./logic/ticket-fields.js";
import { Tickets } from "./logic/ticket.js";

type PluginConfig = {
	db: Database;
};

export default function botTickets(config: PluginConfig) {
	const ticketChannels = new TicketChannels(config.db);
	const ticketFields = new TicketFields(config.db);
	const tickets = new Tickets(config.db, ticketFields);

	const logic = { ticketChannels, ticketFields, tickets };

	return definePlugin((botConfig) => ({
		name: PLUGIN_NAME,
		commands: getCommandModules({ commandExecutor: botConfig.commandExecutor, logic }),
		eventListeners: getEventListenerModules({ logic })
	}));
}
