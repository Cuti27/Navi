import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "./schema.js"

export type DB = ReturnType<typeof drizzle<typeof schema>>

export function createDb(url: string): DB {
    const sqlite = new Database(url)
    sqlite.pragma("journal_mode = WAL")
    return drizzle(sqlite, { schema })
}
