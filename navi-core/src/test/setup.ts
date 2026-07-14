import "dotenv/config"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import * as schema from "../db/schema.js"
import type { DB } from "../db/client.js"

export interface TestDb {
  db: DB
  destroy: () => void
}

export function createTestDb(): TestDb {
  const dbDir = mkdtempSync(join(tmpdir(), "navi-test-"))
  const dbPath = join(dbDir, "test.db")
  const sqlite = new Database(dbPath)
  sqlite.pragma("journal_mode = WAL")
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: "./drizzle" })
  return {
    db,
    destroy: () => {
      rmSync(dbDir, { recursive: true, force: true })
    },
  }
}
