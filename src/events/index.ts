import type { EventListenerModule } from "@l3dev/discord.js-helpers";

import { PLUGIN_NAME } from "../constants.js";
import buttonDeleteChannelEvent from "./button-delete-channel.event.js";
import closeTicketEvent from "./close-ticket.event.js";
import deleteGuildChannelEvent from "./delete-guild-channel.event.js";
import openTicketEvent from "./open-ticket.event.js";
import reopenTicketEvent from "./reopen-ticket.event.js";
import submitCloseTicketEvent from "./submit-close-ticket.event.js";
import submitTicketChannelSetupEvent from "./submit-ticket-channel-setup.event.js";
import submitTicketEvent from "./submit-ticket.event.js";
import type { Logic } from "../logic/index.js";

type GetEventListenerModulesConfig = {
	logic: Logic;
};

export function getEventListenerModules({ logic }: GetEventListenerModulesConfig) {
	return {
		[`${PLUGIN_NAME}/button-delete-channel.event.ts`]: buttonDeleteChannelEvent(logic),
		[`${PLUGIN_NAME}/close-ticket.event.ts`]: closeTicketEvent(logic),
		[`${PLUGIN_NAME}/delete-guild-channel.event.ts`]: deleteGuildChannelEvent(logic),
		[`${PLUGIN_NAME}/open-ticket.event.ts`]: openTicketEvent(logic),
		[`${PLUGIN_NAME}/reopen-ticket.event.ts`]: reopenTicketEvent(logic),
		[`${PLUGIN_NAME}/submit-close-ticket.event.ts`]: submitCloseTicketEvent(logic),
		[`${PLUGIN_NAME}/submit-ticket-channel-setup.event.ts`]: submitTicketChannelSetupEvent(logic),
		[`${PLUGIN_NAME}/submit-ticket.event.ts`]: submitTicketEvent(logic)
	} satisfies Record<string, EventListenerModule<any>>;
}
