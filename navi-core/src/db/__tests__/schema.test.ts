import { describe, it, expect } from "vitest"
import { sessions, messages, toolApprovals, memories } from "../schema.js"

describe("schema", () => {
  it("sessions table has the expected columns", () => {
    const columns = Object.keys(sessions)
    expect(columns).toContain("id")
    expect(columns).toContain("title")
    expect(columns).toContain("contextSummary")
    expect(columns).toContain("lastCompactedMessageId")
    expect(columns).toContain("createdAt")
    expect(columns).toContain("updatedAt")
  })

  it("messages table references sessions", () => {
    const foreignKeys = messages["_" as keyof typeof messages]
    expect(Object.keys(messages)).toContain("sessionId")
  })

  it("messages table has role enum columns", () => {
    const columns = Object.keys(messages)
    expect(columns).toContain("role")
    expect(columns).toContain("content")
    expect(columns).toContain("parts")
    expect(columns).toContain("toolCalls")
    expect(columns).toContain("imageUrl")
  })

  it("toolApprovals table has status enum", () => {
    const columns = Object.keys(toolApprovals)
    expect(columns).toContain("status")
    expect(columns).toContain("reason")
    expect(columns).toContain("signature")
    expect(columns).toContain("decidedAt")
  })

  it("memories table has contentHash for dedup", () => {
    const columns = Object.keys(memories)
    expect(columns).toContain("contentHash")
    expect(columns).toContain("filePath")
    expect(columns).toContain("tags")
  })

  it("sessions have default timestamps", () => {
    const createdAtDefault = sessions.createdAt["default"]
    expect(createdAtDefault).toBeDefined()
    const updatedAtDefault = sessions.updatedAt["default"]
    expect(updatedAtDefault).toBeDefined()
  })
})
