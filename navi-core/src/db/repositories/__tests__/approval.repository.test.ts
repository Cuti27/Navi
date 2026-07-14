import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { DrizzleSessionRepository } from "../session.repository.js"
import { DrizzleApprovalRepository } from "../approval.repository.js"
import { createTestDb } from "../../../test/setup.js"
import type { TestDb } from "../../../test/setup.js"
import type { DB } from "../../client.js"
import { buildSession, buildToolApproval } from "../../../test/factories.js"

describe("DrizzleApprovalRepository", () => {
  let db: DB
  let testDb: TestDb
  let sessionRepo: DrizzleSessionRepository
  let approvalRepo: DrizzleApprovalRepository
  let sessionId: string

  beforeEach(() => {
    testDb = createTestDb()
    db = testDb.db
    sessionRepo = new DrizzleSessionRepository(db)
    approvalRepo = new DrizzleApprovalRepository(db)

    const session = buildSession()
    sessionRepo.create(session)
    sessionId = session.id
  })

  afterEach(() => {
    testDb.destroy()
  })

  it("creates and retrieves a tool approval", async () => {
    const input = buildToolApproval(sessionId)
    const created = await approvalRepo.create(input)
    expect(created.id).toBe(input.id)
    expect(created.status).toBe("pending")
    expect(created.toolName).toBe("test_tool")
  })

  it("getById returns undefined for non-existent", async () => {
    const found = await approvalRepo.getById("nonexistent")
    expect(found).toBeUndefined()
  })

  it("listPendingBySession returns only pending approvals", async () => {
    await approvalRepo.create(buildToolApproval(sessionId, { status: "pending" }))
    await approvalRepo.create(buildToolApproval(sessionId, { status: "approved" }))
    await approvalRepo.create(buildToolApproval(sessionId, { status: "pending" }))

    const pending = await approvalRepo.listPendingBySession(sessionId)
    expect(pending).toHaveLength(2)
    pending.forEach((a) => expect(a.status).toBe("pending"))
  })

  it("approves a pending approval", async () => {
    const input = buildToolApproval(sessionId)
    await approvalRepo.create(input)

    const updated = await approvalRepo.updateStatus(input.id, "approved")
    expect(updated.status).toBe("approved")
    expect(updated.decidedAt).toBeInstanceOf(Date)
  })

  it("denies a pending approval with reason", async () => {
    const input = buildToolApproval(sessionId)
    await approvalRepo.create(input)

    const updated = await approvalRepo.updateStatus(input.id, "denied", "Not needed")
    expect(updated.status).toBe("denied")
    expect(updated.reason).toBe("Not needed")
  })

  it("throws when updating status of non-existent approval", async () => {
    await expect(approvalRepo.updateStatus("nonexistent", "approved")).rejects.toThrow(
      "Tool approval not found",
    )
  })

  it("throws when updating status of an already-decided approval", async () => {
    const input = buildToolApproval(sessionId)
    await approvalRepo.create(input)
    await approvalRepo.updateStatus(input.id, "approved")

    await expect(approvalRepo.updateStatus(input.id, "denied")).rejects.toThrow(
      "already approved",
    )
  })
})
