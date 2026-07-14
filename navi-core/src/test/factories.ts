import { randomUUID } from "node:crypto"
import type { NewSession, NewMessage, NewToolApproval, NewMemory } from "../db/schema.js"

export function buildSession(overrides: Partial<NewSession> = {}): NewSession {
  return {
    id: randomUUID(),
    title: "Test session",
    ...overrides,
  }
}

export function buildMessage(
  sessionId: string,
  overrides: Partial<NewMessage> = {},
): NewMessage {
  return {
    id: randomUUID(),
    sessionId,
    role: "user",
    content: "Hello",
    ...overrides,
  }
}

export function buildToolApproval(
  sessionId: string,
  overrides: Partial<NewToolApproval> = {},
): NewToolApproval {
  return {
    id: randomUUID(),
    sessionId,
    toolCallId: randomUUID(),
    toolName: "test_tool",
    input: { arg: "value" } as unknown as NewToolApproval["input"],
    status: "pending",
    ...overrides,
  }
}

export function buildMemory(overrides: Partial<NewMemory> = {}): NewMemory {
  return {
    id: randomUUID(),
    filePath: "general/test.md",
    title: "Test memory",
    category: "general",
    content: "Some remembered content",
    tags: ["test"],
    contentHash: "abc123",
    ...overrides,
  }
}
