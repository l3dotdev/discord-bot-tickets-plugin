export const PLUGIN_NAME = "@l3dev/discord-bot-tickets-plugin";

export enum ButtonCustomId {
	OpenBotTicket = "open-bot-ticket",
	CloseBotTicket = "close-bot-ticket",
	CloseBotTicketWithReason = "close-bot-ticket-with-reason",
	ReopenBotTicket = "reopen-bot-ticket",
	DeleteBotTicketChannel = "delete-bot-ticket-channel",
	CancelDeleteBotTicketChannel = "cancel-delete-bot-ticket-channel"
}

export enum ModalCustomId {
	BotTicketSetupModal = "bot-ticket-setup-modal",
	BotTicketModal = "bot-ticket-modal",
	CloseBotTicketModal = "close-bot-ticket-modal"
}

export enum BotTicketSetupModalCustomId {
	Heading = "heading",
	Description = "description",
	ModalTitle = "modal_title",
	TicketName = "ticket_name",
	TicketDescription = "ticket_description"
}

export enum CloseBotTicketModalCustomId {
	Reason = "reason"
}
