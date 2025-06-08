import {
	addSubcommands,
	createSubcommandExecutor,
	defineCommand,
	loadSubcommands
} from "@l3dev/discord.js-helpers";
import type { CommandExecutor } from "@l3dev/discord.js-helpers";
import { logger } from "@l3dev/logger";

import { PLUGIN_NAME } from "../constants.js";
import addFieldCommand from "./tickets/add-field.command.js";
import deleteCommand from "./tickets/delete.command.js";
import editCommand from "./tickets/edit.command.js";
import fixCommand from "./tickets/fix.command.js";
import removeAllFieldsCommand from "./tickets/remove-all-fields.command.js";
import removeFieldCommand from "./tickets/remove-field.command.js";
import setMentionsCommand from "./tickets/set-mentions.command.js";
import setPerUserLimitCommand from "./tickets/set-per-user-limit.command.js";
import setupCommand from "./tickets/setup.command.js";
import type { Logic } from "../logic/index.js";
import { errorMessage } from "../messages/error.message.js";

export default function (commandExecutor: CommandExecutor, logic: Logic) {
	const name = "tickets";

	const subcommands = loadSubcommands({
		parentCommandName: name,
		getModules<T>() {
			return {
				[`${PLUGIN_NAME}/tickets/add-field.command.ts`]: addFieldCommand(logic),
				[`${PLUGIN_NAME}/tickets/delete.command.ts`]: deleteCommand(logic),
				[`${PLUGIN_NAME}/tickets/edit.command.ts`]: editCommand(logic),
				[`${PLUGIN_NAME}/tickets/fix.command.ts`]: fixCommand(logic),
				[`${PLUGIN_NAME}/tickets/remove-all-fields.command.ts`]: removeAllFieldsCommand(logic),
				[`${PLUGIN_NAME}/tickets/remove-field.command.ts`]: removeFieldCommand(logic),
				[`${PLUGIN_NAME}/tickets/set-mentions.command.ts`]: setMentionsCommand(logic),
				[`${PLUGIN_NAME}/tickets/set-per-user-limit.command.ts`]: setPerUserLimitCommand(logic),
				[`${PLUGIN_NAME}/tickets/setup.command.ts`]: setupCommand(logic)
			} as unknown as Record<string, T>;
		},
		logger
	});

	return {
		default: defineCommand({
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
		})
	};
}
