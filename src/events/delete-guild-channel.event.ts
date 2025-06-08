import { defineEventListener } from "@l3dev/discord.js-helpers";
import { logger } from "@l3dev/logger";
import { NONE } from "@l3dev/result";
import { Events } from "discord.js";

import type { Logic } from "../logic/index.js";

export default function ({ ticketChannels }: Logic) {
	return {
		default: defineEventListener({
			event: Events.ChannelDelete,
			listener: async function (channel) {
				if (channel.isDMBased()) {
					return NONE;
				}

				const ticketChannelResult = await ticketChannels.getChannelByDiscordId(channel.id);
				if (!ticketChannelResult.ok) return ticketChannelResult;

				const ticketChannel = ticketChannelResult.value;
				if (!ticketChannel) return NONE;

				logger.info(
					`Guild channel ${channel.id} deleted, deleting ticket channel ${ticketChannel.id}`
				);

				const deleteChannelResult = await ticketChannels.deleteChannel(
					channel.client,
					ticketChannel,
					true
				);
				if (!deleteChannelResult.ok) return deleteChannelResult;

				logger.info(`Successfully deleted ticket channel ${ticketChannel.id}`);

				return NONE;
			}
		})
	};
}
