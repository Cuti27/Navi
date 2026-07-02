import type { DB } from "../client.js"
import { sessions } from "../schema.js"
import { eq } from "drizzle-orm"
import type { Session, NewSession } from "../schema.js"

export interface SessionRepository {
    create(input: NewSession): Promise<Session>
    getById(id: string): Promise<Session | undefined>
    list(): Promise<Session[]>
    update(id: string, data: Partial<Pick<Session, "title" | "contextSummary">>): Promise<void>
    delete(id: string): Promise<void>
}

export class DrizzleSessionRepository implements SessionRepository {
    constructor(private readonly db: DB) {}

    async create(input: NewSession): Promise<Session> {
        await this.db.insert(sessions).values(input)
        const session = await this.getById(input.id)
        if (!session) {
            throw new Error("Failed to create session")
        }
        return session
    }

    async getById(id: string): Promise<Session | undefined> {
        const result = await this.db.query.sessions.findFirst({
            where: eq(sessions.id, id),
        })
        return result
    }

    async list(): Promise<Session[]> {
        return this.db.query.sessions.findMany({
            orderBy: (sessions, { desc }) => [desc(sessions.updatedAt)],
        })
    }

    async update(
        id: string,
        data: Partial<Pick<Session, "title" | "contextSummary">>
    ): Promise<void> {
        await this.db
            .update(sessions)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(sessions.id, id))
    }

    async delete(id: string): Promise<void> {
        await this.db.delete(sessions).where(eq(sessions.id, id))
    }
}
