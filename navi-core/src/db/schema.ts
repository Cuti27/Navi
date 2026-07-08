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
    /**
     * Structured ModelMessage content parts for assistant tool calls and
     * tool results/approval-responses. Enables HITL round-tripping.
     */
    parts: text("parts", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
})

/**
 * Tracks the lifecycle of each HITL tool approval request.
 */
export const toolApprovals = sqliteTable("tool_approvals", {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
        .notNull()
        .references(() => sessions.id, { onDelete: "cascade" }),
    toolCallId: text("tool_call_id").notNull(),
    toolName: text("tool_name").notNull(),
    input: text("input", { mode: "json" }).notNull(),
    description: text("description"),
    status: text("status", { enum: ["pending", "approved", "denied"] })
        .notNull()
        .default("pending"),
    reason: text("reason"),
    signature: text("signature"),
    decidedAt: integer("decided_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(strftime('%s', 'now'))`),
})

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert

export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert

export type ToolApproval = typeof toolApprovals.$inferSelect
export type NewToolApproval = typeof toolApprovals.$inferInsert
