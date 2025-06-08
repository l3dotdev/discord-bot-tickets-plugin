import type { CommandExecutor, CommandModule } from "@l3dev/discord.js-helpers";
import type { SlashCommandBuilder } from "discord.js";

import ticketsCommand from "./tickets.command.js";
import { PLUGIN_NAME } from "../constants.js";
import type { Logic } from "../logic/index.js";

type GetCommandModulesConfig = {
	commandExecutor: CommandExecutor;
	logic: Logic;
};

export function getCommandModules({ commandExecutor, logic }: GetCommandModulesConfig) {
	return {
		[`${PLUGIN_NAME}/tickets.command.ts`]: ticketsCommand(commandExecutor, logic)
	} satisfies Record<string, CommandModule<SlashCommandBuilder>>;
}
