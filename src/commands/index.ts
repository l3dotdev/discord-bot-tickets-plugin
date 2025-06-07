import type { CommandExecutor } from "@l3dev/discord.js-helpers";

import { createTicketsCommand } from "./tickets.command.js";

type GetCommandModulesConfig = {
	commandExecutor: CommandExecutor;
};

export function getCommandModules<T>({ commandExecutor }: GetCommandModulesConfig) {
	return {
		"@l3dev/discord-bot-tickets-plugin/tickets.command.ts": {
			default: createTicketsCommand(commandExecutor)
		}
	} as unknown as Record<string, T>;
}
