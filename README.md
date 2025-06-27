# discord-bot-tickets-plugin

## Usage

Add the plugin to the bot config and pass in the plugin config

```ts
import botTickets from "@l3dev/discord-bot-tickets-plugin";
import { createBot } from "@l3dev/discord.js-helpers";

const bot = createBot({
    ...
    plugins: [botTickets({ db })]
});
```

Create a schema file (e.g. `bot-tickets.schema.ts`) in the drizzle schema folder

```ts
export * from "@l3dev/discord-bot-tickets-plugin/db-schema";
```

## Discord Usage Documentation

- [Documentation](docs/README.md)
