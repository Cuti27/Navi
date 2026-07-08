import { eq, and, desc } from "drizzle-orm"
import type { DB } from "../client.js"
import { toolApprovals } from "../schema.js"
import type { ToolApproval, NewToolApproval } from "../schema.js"

export interface ApprovalRepository {
    create(input: NewToolApproval): Promise<ToolApproval>
    getById(id: string): Promise<ToolApproval | undefined>
    listPendingBySession(sessionId: string): Promise<ToolApproval[]>
    updateStatus(
        id: string,
        status: "approved" | "denied",
        reason?: string
    ): Promise<ToolApproval>
}

export class DrizzleApprovalRepository implements ApprovalRepository {
    constructor(private readonly db: DB) {}

    async create(input: NewToolApproval): Promise<ToolApproval> {
        await this.db.insert(toolApprovals).values(input)
        const approval = await this.db.query.toolApprovals.findFirst({
            where: eq(toolApprovals.id, input.id),
        })
        if (!approval) {
            throw new Error("Failed to create tool approval")
        }
        return approval
    }

    async getById(id: string): Promise<ToolApproval | undefined> {
        return this.db.query.toolApprovals.findFirst({
            where: eq(toolApprovals.id, id),
        })
    }

    async listPendingBySession(sessionId: string): Promise<ToolApproval[]> {
        return this.db.query.toolApprovals.findMany({
            where: and(
                eq(toolApprovals.sessionId, sessionId),
                eq(toolApprovals.status, "pending")
            ),
            orderBy: [desc(toolApprovals.createdAt)],
        })
    }

    async updateStatus(
        id: string,
        status: "approved" | "denied",
        reason?: string
    ): Promise<ToolApproval> {
        const existing = await this.getById(id)
        if (!existing) {
            throw new Error(`Tool approval not found: ${id}`)
        }
        if (existing.status !== "pending") {
            throw new Error(
                `Tool approval ${id} is already ${existing.status}`
            )
        }

        await this.db
            .update(toolApprovals)
            .set({
                status,
                reason,
                decidedAt: new Date(),
            })
            .where(eq(toolApprovals.id, id))

        const updated = await this.getById(id)
        if (!updated) {
            throw new Error("Failed to update tool approval")
        }
        return updated
    }
}
