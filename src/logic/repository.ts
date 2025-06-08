import type { WrappedDrizzle } from "@l3dev/drizzle-helpers";

import * as schema from "../db-schema/index.js";

export type Database = WrappedDrizzle<typeof schema>;

export abstract class Repository {
	protected readonly db: Database;

	constructor(db: Database) {
		this.db = db;
	}
}
