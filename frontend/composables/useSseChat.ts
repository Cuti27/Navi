import type { UIMessage, ApprovalPayload, ToolSummaryCall } from '~/lib/types'

export function useSseChat() {
  const api = useNaviApi()
  const agent = useAgentStore()

  const messages = ref<UIMessage[]>([])
  const isStreaming = ref(false)
  const error = ref<string | null>(null)
  const pendingApprovals = ref<ApprovalPayload[]>([])
  const currentToolCalls = ref<ToolSummaryCall[]>([])

  let abortController: AbortController | null = null

  function resetMessages() {
    messages.value = []
    pendingApprovals.value = []
    currentToolCalls.value = []
  }

  function loadHistory(
    backendMessages: Array<{ id: string; role: string; content: string; createdAt: string }>
  ) {
    messages.value = backendMessages
      .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content.trim() !== ''))
      .map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: m.createdAt,
      }))
  }

  async function loadPendingApprovals(sessionId: string) {
    try {
      const approvals = await api.getPendingApprovals(sessionId)
      pendingApprovals.value = approvals
        .filter((a) => a.status === 'pending')
        .map((a) => ({
          approvalId: a.id,
          toolCallId: a.toolCallId,
          toolName: a.toolName,
          description: a.description ?? `Navi quiere ejecutar '${a.toolName}'`,
          input: a.input,
          signature: a.signature ?? undefined,
        }))
      if (pendingApprovals.value.length > 0) {
        agent.setState('awaiting-approval')
      }
    } catch (err) {
      console.error('Failed to load pending approvals', err)
    }
  }

  function addUserMessage(text: string) {
    messages.value.push({
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    })
  }

  function addAssistantPlaceholder() {
    messages.value.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    })
  }

  function appendToLastAssistant(text: string) {
    const last = messages.value[messages.value.length - 1]
    if (last && last.role === 'assistant') {
      messages.value[messages.value.length - 1] = {
        ...last,
        content: last.content + text,
      }
    }
  }

  function removePendingApproval(approvalId: string) {
    pendingApprovals.value = pendingApprovals.value.filter((a) => a.approvalId !== approvalId)
  }

  function pruneEmptyAssistantBeforeTool() {
    const len = messages.value.length
    if (len < 2) return
    const beforeTool = messages.value[len - 2]
    if (beforeTool?.role === 'assistant' && beforeTool.content === '') {
      messages.value = messages.value.filter((_, idx) => idx !== len - 2)
    }
  }

  function pruneTrailingEmptyAssistant() {
    const last = messages.value[messages.value.length - 1]
    if (last?.role === 'assistant' && last.content === '') {
      messages.value = messages.value.slice(0, -1)
    }
  }

  function pushToolSummary() {
    if (currentToolCalls.value.length === 0) return

    const count = currentToolCalls.value.length
    const label = `${count} tool${count > 1 ? 's' : ''} llamada${count > 1 ? 's' : ''}`

    messages.value.push({
      id: crypto.randomUUID(),
      role: 'tool-summary',
      content: label,
      meta: { calls: [...currentToolCalls.value] },
      createdAt: new Date().toISOString(),
    })

    currentToolCalls.value = []
  }

  function parseSseEvents(buffer: string): Array<{ event: string; data: string }> {
    const events: Array<{ event: string; data: string }> = []
    const blocks = buffer.split('\n\n')
    for (const block of blocks) {
      if (!block.trim()) continue
      let event = 'message'
      const dataLines: string[] = []
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) {
          event = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          // Per the SSE spec, consecutive "data:" lines are concatenated
          // with "\n". Only the single optional space after "data:" is stripped.
          let d = line.slice(5)
          if (d.startsWith(' ')) d = d.slice(1)
          dataLines.push(d)
        }
      }
      const data = dataLines.join('\n')
      if (data || event !== 'message') {
        events.push({ event, data })
      }
    }
    return events
  }

  async function readStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onEvent: (event: string, data: string) => void
  ) {
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      const events = parseSseEvents(parts.join('\n\n'))
      for (const ev of events) {
        onEvent(ev.event, ev.data)
      }
    }
    if (buffer.trim()) {
      const events = parseSseEvents(buffer)
      for (const ev of events) onEvent(ev.event, ev.data)
    }
  }

  function handleEvent(event: string, data: string) {
    if (event === 'message') {
      let text = data
      try {
        text = JSON.parse(data)
      } catch {
        // legacy backends sent raw text; keep it as-is
      }

      // After a tool-result/tool-denied event the assistant continues the
      // same stream with a new assistant message. Make sure there is a
      // placeholder to append to.
      const last = messages.value[messages.value.length - 1]
      if (!last || last.role !== 'assistant') {
        addAssistantPlaceholder()
      }

      appendToLastAssistant(text)
      agent.setState('thinking')
      return
    }

    if (event === 'tool-approval-request') {
      try {
        const payload = JSON.parse(data)
        pendingApprovals.value.push({
          approvalId: payload.approvalId,
          toolCallId: payload.toolCallId,
          toolName: payload.toolName,
          description: payload.description || `Navi quiere ejecutar '${payload.toolName}'`,
          input: payload.input,
          signature: payload.signature,
        })
        agent.setState('awaiting-approval')
      } catch {
        // ignore malformed event
      }
      return
    }

    if (event === 'tool-result') {
      try {
        const payload = JSON.parse(data)
        currentToolCalls.value.push({
          toolName: payload.toolName,
          input: payload.input,
        })
        pruneEmptyAssistantBeforeTool()
        agent.setState('tool-calling')
      } catch {
        // ignore
      }
      return
    }

    if (event === 'tool-output-denied') {
      try {
        pruneEmptyAssistantBeforeTool()
        agent.setState('tool-calling')
      } catch {
        // ignore
      }
      return
    }

    if (event === 'done') {
      try {
        const payload = JSON.parse(data)
        if (payload.reason === 'awaiting-approval') {
          agent.setState('awaiting-approval')
        } else {
          agent.setState('idle')
          pruneTrailingEmptyAssistant()
          pushToolSummary()
        }
      } catch {
        agent.setState('idle')
        pruneTrailingEmptyAssistant()
        pushToolSummary()
      }
      // Force the UI out of streaming mode immediately. Some browsers do not
      // fire reader.done promptly even after the server closes the connection.
      isStreaming.value = false
      abortController?.abort()
      return
    }
  }

  function cancel() {
    abortController?.abort()
    abortController = null
    isStreaming.value = false
    if (!error.value) agent.setState('idle')
  }

  async function sendMessage(sessionId: string, userMessage: string) {
    if (isStreaming.value) return
    error.value = null
    isStreaming.value = true
    agent.setState('thinking')

    // If the user starts typing while a tool approval is pending, cancel all
    // pending approvals and continue with the new message.
    const cancelPendingApprovals = pendingApprovals.value.length > 0
    if (cancelPendingApprovals) {
      pendingApprovals.value = []
    }

    currentToolCalls.value = []

    addUserMessage(userMessage)
    addAssistantPlaceholder()

    abortController = new AbortController()

    try {
      const response = await api.sendMessage(
        sessionId,
        userMessage,
        cancelPendingApprovals,
        abortController.signal
      )
      if (!response.body) throw new Error('Respuesta sin cuerpo de stream')
      const reader = response.body.getReader()
      await readStream(reader, handleEvent)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      error.value = err instanceof Error ? err.message : 'Error de conexión'
      agent.setState('error')
    } finally {
      abortController = null
      isStreaming.value = false
    }
  }

  async function submitApproval(
    sessionId: string,
    approvalId: string,
    approved: boolean,
    reason?: string
  ) {
    if (isStreaming.value) return

    const approval = pendingApprovals.value.find((a) => a.approvalId === approvalId)
    if (!approval) return

    // Record the user's choice on this approval. We only send the batch to
    // the backend once every pending approval from the current step has been
    // answered. The AI SDK requires all tool calls in a step to be resolved
    // together; sending partial responses leaves tool calls without results
    // and causes a MissingToolResultsError.
    approval.response = { approvalId, approved, reason }

    const unanswered = pendingApprovals.value.filter((a) => a.response === undefined)
    if (unanswered.length > 0) {
      return
    }

    error.value = null
    isStreaming.value = true
    agent.setState('thinking')

    const responses = pendingApprovals.value.map((a) => a.response!)
    pendingApprovals.value = []

    abortController = new AbortController()

    try {
      const response = await api.submitApprovals({
        sessionId,
        responses,
      }, abortController.signal)
      if (!response.body) throw new Error('Respuesta sin cuerpo de stream')
      const reader = response.body.getReader()
      addAssistantPlaceholder()
      await readStream(reader, handleEvent)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      error.value = err instanceof Error ? err.message : 'Error al enviar aprobación'
      agent.setState('error')
    } finally {
      abortController = null
      isStreaming.value = false
    }
  }

  return {
    messages,
    isStreaming,
    error,
    pendingApprovals,
    sendMessage,
    submitApproval,
    loadHistory,
    loadPendingApprovals,
    resetMessages,
    cancel,
  }
}
