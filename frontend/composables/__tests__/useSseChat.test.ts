import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '~/stores/auth'
import { useSseChat } from '../useSseChat'

const apiBase = 'http://localhost:3000/api/v1'

vi.stubGlobal('useRuntimeConfig', () => ({
  public: { apiBase },
}))

function stubFetch(handler: (url: string, options?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(handler))
}

function makeSseResponse(...chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

describe('useSseChat', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.setToken('test-token')
  })

  it('loadHistory maps backend messages to UIMessages', () => {
    const chat = useSseChat()
    chat.loadHistory([
      { id: '1', role: 'user', content: 'Hello', createdAt: new Date().toISOString() },
      { id: '2', role: 'assistant', content: 'Hi!', createdAt: new Date().toISOString() },
    ])
    expect(chat.messages.value).toHaveLength(2)
    expect(chat.messages.value[0].role).toBe('user')
    expect(chat.messages.value[1].role).toBe('assistant')
  })

  it('loadHistory filters out non-user/assistant roles', () => {
    const chat = useSseChat()
    chat.loadHistory([
      { id: '1', role: 'user', content: 'Hello', createdAt: '' },
      { id: '2', role: 'system', content: 'System msg', createdAt: '' },
      { id: '3', role: 'tool', content: 'Tool output', createdAt: '' },
    ])
    expect(chat.messages.value).toHaveLength(1)
  })

  it('resetMessages clears messages and pending approvals', () => {
    const chat = useSseChat()
    chat.loadHistory([
      { id: '1', role: 'user', content: 'Test', createdAt: '' },
    ])
    chat.pendingApprovals.value = [
      {
        approvalId: 'a1',
        toolCallId: 'c1',
        toolName: 'test_tool',
        description: '¿Permites?',
      },
    ]

    chat.resetMessages()

    expect(chat.messages.value).toHaveLength(0)
    expect(chat.pendingApprovals.value).toHaveLength(0)
  })

  it('sendMessage sends and processes SSE stream', async () => {
    stubFetch(() =>
      makeSseResponse(
        'data: Hola\n\n',
        'event: done\ndata: {"reason":"complete"}\n\n',
      ),
    )

    const chat = useSseChat()
    await chat.sendMessage('session-1', 'Hola')
    expect(chat.messages.value.length).toBeGreaterThan(0)
    expect(chat.isStreaming.value).toBe(false)
  })

  it('renders assistant text that arrives after a tool result in the same bubble', async () => {
    stubFetch(() =>
      makeSseResponse(
        'data: "Voy a consultar."\n\n',
        'event: tool-result\ndata: {"toolCallId":"c1","toolName":"ask_question","input":{"repoName":"foo/bar"},"output":{"ok":true}}\n\n',
        'data: " He encontrado la respuesta."\n\n',
        'event: done\ndata: {"reason":"complete"}\n\n',
      ),
    )

    const chat = useSseChat()
    await chat.sendMessage('session-3', 'Consulta')

    const assistantMessages = chat.messages.value.filter((m) => m.role === 'assistant')
    expect(assistantMessages).toHaveLength(1)
    expect(assistantMessages[0].content).toBe('Voy a consultar. He encontrado la respuesta.')
  })

  it('adds a tool-summary message after the response completes', async () => {
    stubFetch(() =>
      makeSseResponse(
        'event: tool-result\ndata: {"toolCallId":"c1","toolName":"ask_question","input":{"repoName":"foo/bar"},"output":{"ok":true}}\n\n',
        'data: "Respuesta."\n\n',
        'event: done\ndata: {"reason":"complete"}\n\n',
      ),
    )

    const chat = useSseChat()
    await chat.sendMessage('session-5', 'Consulta')

    const summaries = chat.messages.value.filter((m) => m.role === 'tool-summary')
    expect(summaries).toHaveLength(1)
    expect(summaries[0].content).toContain('1 tool llamada')
    expect((summaries[0].meta as any).calls[0].toolName).toBe('ask_question')
  })

  it('prunes empty assistant placeholder when tool is called before any text', async () => {
    stubFetch(() =>
      makeSseResponse(
        'event: tool-result\ndata: {"toolCallId":"c1","toolName":"ask_question","output":{"ok":true}}\n\n',
        'data: "Respuesta tras la tool."\n\n',
        'event: done\ndata: {"reason":"complete"}\n\n',
      ),
    )

    const chat = useSseChat()
    await chat.sendMessage('session-4', 'Consulta')

    const assistantMessages = chat.messages.value.filter((m) => m.role === 'assistant')
    expect(assistantMessages).toHaveLength(1)
    expect(assistantMessages[0].content).toBe('Respuesta tras la tool.')
  })

  it('sendMessage stores tool approval requests in pendingApprovals', async () => {
    stubFetch(() =>
      makeSseResponse(
        'data: Necesito aprobación\n\n',
        'event: tool-approval-request\ndata: {"approvalId":"a1","toolCallId":"c1","toolName":"test_tool","description":"¿Permites?"}\n\n',
        'event: done\ndata: {"reason":"awaiting-approval"}\n\n',
      ),
    )

    const chat = useSseChat()
    await chat.sendMessage('session-2', 'Ejecuta algo')

    expect(chat.pendingApprovals.value).toHaveLength(1)
    expect(chat.pendingApprovals.value[0].approvalId).toBe('a1')
    expect(chat.pendingApprovals.value[0].toolName).toBe('test_tool')
    expect(chat.isStreaming.value).toBe(false)
  })

  it('submitApproval removes the pending approval and reads response stream', async () => {
    stubFetch(() =>
      makeSseResponse(
        'data: Ejecutado\n\n',
        'event: done\ndata: {"reason":"complete"}\n\n',
      ),
    )

    const chat = useSseChat()
    chat.pendingApprovals.value = [
      {
        approvalId: 'approval-1',
        toolCallId: 'c1',
        toolName: 'test_tool',
        description: '¿Permites?',
      },
    ]

    await chat.submitApproval('session-1', 'approval-1', true)

    expect(chat.pendingApprovals.value).toHaveLength(0)
    expect(chat.isStreaming.value).toBe(false)
  })

  it('submitApproval waits for every pending approval before sending the batch', async () => {
    stubFetch((url, options) => {
      expect(url).toBe(`${apiBase}/chat/approvals`)
      expect(options?.method).toBe('POST')
      const body = JSON.parse(options?.body as string)
      expect(body.responses).toHaveLength(2)
      expect(body.responses).toContainEqual({
        approvalId: 'approval-1',
        approved: true,
      })
      expect(body.responses).toContainEqual({
        approvalId: 'approval-2',
        approved: false,
        reason: 'Usuario canceló la acción',
      })

      return makeSseResponse(
        'data: Ejecutado\n\n',
        'event: done\ndata: {"reason":"complete"}\n\n',
      )
    })

    const chat = useSseChat()
    chat.pendingApprovals.value = [
      {
        approvalId: 'approval-1',
        toolCallId: 'c1',
        toolName: 'test_tool',
        description: '¿Permites?',
      },
      {
        approvalId: 'approval-2',
        toolCallId: 'c2',
        toolName: 'test_tool',
        description: '¿Permites?',
      },
    ]

    await chat.submitApproval('session-1', 'approval-1', true)

    expect(chat.pendingApprovals.value).toHaveLength(2)
    expect(chat.isStreaming.value).toBe(false)

    await chat.submitApproval(
      'session-1',
      'approval-2',
      false,
      'Usuario canceló la acción',
    )

    expect(chat.pendingApprovals.value).toHaveLength(0)
    expect(chat.isStreaming.value).toBe(false)
  })

  it('cancel aborts an active stream', async () => {
    stubFetch(() =>
      makeSseResponse(
        'data: Inicio\n\n',
        'event: done\ndata: {"reason":"complete"}\n\n',
      ),
    )

    const chat = useSseChat()
    const promise = chat.sendMessage('session-1', 'Cancel me')
    chat.cancel()
    await promise
    // After cancel, isStreaming should be false
    expect(chat.isStreaming.value).toBe(false)
  })
})
