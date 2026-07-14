import type { Session, Message, PendingApproval, UIMessage } from '~/lib/types'

export function buildSession(overrides: Partial<Session> = {}): Session {
  return {
    id: crypto.randomUUID(),
    title: 'Test session',
    contextSummary: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

export function buildMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    role: 'user',
    content: 'Hello',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function buildPendingApproval(overrides: Partial<PendingApproval> = {}): PendingApproval {
  return {
    id: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
    toolCallId: crypto.randomUUID(),
    toolName: 'test_tool',
    input: { arg: 'value' },
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function buildUiMessage(overrides: Partial<UIMessage> = {}): UIMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content: 'Hello',
    ...overrides,
  }
}

export function createSseResponse(
  chunks: Array<{ event?: string; data: string }>,
): Response {
  const encoder = new TextEncoder()
  let body = ''
  for (const chunk of chunks) {
    if (chunk.event) {
      body += `event: ${chunk.event}\n`
    }
    body += `data: ${chunk.data}\n\n`
  }
  return new Response(encoder.encode(body), {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}
