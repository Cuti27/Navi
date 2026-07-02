import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"

export const sessions = sqliteTable("sessions", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    contextSummary: text("context_summary"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
})

export const messages = sqliteTable("messages", {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
        .notNull()
        .references(() => sessions.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant", "system", "tool"] }).notNull(),
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    toolCalls: text("tool_calls", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
})

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
