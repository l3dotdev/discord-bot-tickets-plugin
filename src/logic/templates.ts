import type { User } from "discord.js";

export function resolveTemplate(template: string, user: User, isMessage = true) {
	template = template.replaceAll("{user}", isMessage ? `<@${user.id}>` : user.username);
	template = template.replaceAll("{username}", user.username);

	const now = new Date();
	const unix = Math.floor(now.getTime() / 1000);
	const timeString = `${now.getUTCHours().toString().padStart(2, "0")}:${now.getUTCMinutes().toString().padStart(2, "0")}`;
	const dateString = `${now.getUTCFullYear()}-${now.getUTCMonth().toString().padStart(2, "0")}-${now.getUTCDate().toString().padStart(2, "0")}`;
	template = template.replaceAll("{time}", isMessage ? `<t:${unix}:t>` : timeString);
	template = template.replaceAll("{date}", isMessage ? `<t:${unix}:d>` : dateString);
	template = template.replaceAll(
		"{datetime}",
		isMessage ? `<t:${unix}:f>` : `${dateString} ${timeString}`
	);
	template = template.replaceAll("{year}", now.getUTCFullYear().toString());

	return template;
}
