import { eq, desc, asc } from "drizzle-orm"
import type { DB } from "../client.js"
import { messages } from "../schema.js"
import type { Message, NewMessage } from "../schema.js"

export interface MessageRepository {
    create(input: NewMessage): Promise<Message>
    listBySession(sessionId: string, limit?: number): Promise<Message[]>
    listBySessionChronological(sessionId: string, limit?: number): Promise<Message[]>
}

export class DrizzleMessageRepository implements MessageRepository {
    constructor(private readonly db: DB) {}

    async create(input: NewMessage): Promise<Message> {
        await this.db.insert(messages).values(input)
        const message = await this.db.query.messages.findFirst({
            where: eq(messages.id, input.id),
        })
        if (!message) {
            throw new Error("Failed to create message")
        }
        return message
    }

    async listBySession(sessionId: string, limit = 20): Promise<Message[]> {
        return this.db.query.messages.findMany({
            where: eq(messages.sessionId, sessionId),
            orderBy: [desc(messages.createdAt)],
            limit,
        })
    }

    async listBySessionChronological(
        sessionId: string,
        limit = 100
    ): Promise<Message[]> {
        return this.db.query.messages.findMany({
            where: eq(messages.sessionId, sessionId),
            orderBy: [asc(messages.createdAt)],
            limit,
        })
    }
}
