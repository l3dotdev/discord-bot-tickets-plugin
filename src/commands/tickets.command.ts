import {
	addSubcommands,
	createSubcommandExecutor,
	defineCommand,
	loadSubcommands
} from "@l3dev/discord.js-helpers";
import type { CommandExecutor } from "@l3dev/discord.js-helpers";
import { logger } from "@l3dev/logger";

import * as addFieldCommand from "./tickets/add-field.command.js";
import * as deleteCommand from "./tickets/delete.command.js";
import * as editCommand from "./tickets/edit.command.js";
import * as fixCommand from "./tickets/fix.command.js";
import * as removeAllFieldsCommand from "./tickets/remove-all-fields.command.js";
import * as removeFieldCommand from "./tickets/remove-field.command.js";
import * as setMentionsCommand from "./tickets/set-mentions.command.js";
import * as setPerUserLimitCommand from "./tickets/set-per-user-limit.command.js";
import * as setupCommand from "./tickets/setup.command.js";
import { errorMessage } from "../messages/error.message.js";

type CreateTicketsCommandConfig = {
	commandExecutor: CommandExecutor;
};

export function createTicketsCommand({ commandExecutor }: CreateTicketsCommandConfig) {
	const name = "tickets";

	const subcommands = loadSubcommands({
		parentCommandName: name,
		getModules<T>() {
			return {
				"add-field.command.ts": addFieldCommand,
				"delete.command.ts": deleteCommand,
				"edit.command.ts": editCommand,
				"fix.command.ts": fixCommand,
				"remove-all-fields.command.ts": removeAllFieldsCommand,
				"remove-field.command.ts": removeFieldCommand,
				"set-mentions.command.ts": setMentionsCommand,
				"set-per-user-limit.command.ts": setPerUserLimitCommand,
				"setup.command.ts": setupCommand
			} as unknown as Record<string, T>;
		},
		logger
	});

	return defineCommand({
		name,
		subcommands,
		define(builder) {
			builder = builder.setName(this.name).setDescription("Manage and configure bot tickets");
			addSubcommands(builder, subcommands);

			return builder;
		},
		execute: createSubcommandExecutor({
			subcommands,
			commandExecutor,
			getNotFoundMessage(subcommandName, _interaction) {
				return errorMessage.build(`Unknown subcommand '${subcommandName}'`);
			}
		})
	});
}
