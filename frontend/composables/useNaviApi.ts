import type {
  ApprovalSubmission,
  Message,
  PendingApproval,
  Session,
} from '~/lib/types'

export function useNaviApi() {
  const config = useRuntimeConfig()
  const auth = useAuthStore()

  const baseURL = config.public.apiBase as string

  const authHeaders = () => ({
    Authorization: `Bearer ${auth.token}`,
    'Content-Type': 'application/json',
  })

  async function getSessions(): Promise<Session[]> {
    return $fetch<Session[]>('/sessions', { baseURL, headers: authHeaders() })
  }

  async function createSession(title?: string): Promise<Session> {
    return $fetch<Session>('/sessions', {
      baseURL,
      method: 'POST',
      body: { title },
      headers: authHeaders(),
    })
  }

  async function getSession(id: string): Promise<{ session: Session; messages: Message[] }> {
    return $fetch<{ session: Session; messages: Message[] }>(`/sessions/${id}`, {
      baseURL,
      headers: authHeaders(),
    })
  }

  async function updateSession(id: string, title: string): Promise<Session> {
    return $fetch<Session>(`/sessions/${id}`, {
      baseURL,
      method: 'PATCH',
      body: { title },
      headers: authHeaders(),
    })
  }

  async function deleteSession(id: string): Promise<void> {
    await $fetch(`/sessions/${id}`, {
      baseURL,
      method: 'DELETE',
      headers: authHeaders(),
    })
  }

  async function getPendingApprovals(sessionId: string): Promise<PendingApproval[]> {
    return $fetch<PendingApproval[]>('/chat/approvals', {
      baseURL,
      query: { sessionId },
      headers: authHeaders(),
    })
  }

  async function sendMessage(
    sessionId: string,
    message: string,
    cancelPendingApprovals = false,
    signal?: AbortSignal
  ): Promise<Response> {
    const response = await fetch(`${baseURL}/chat`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ sessionId, message, cancelPendingApprovals }),
      signal,
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Error ${response.status}: ${text || 'Error inesperado del servidor'}`)
    }
    return response
  }

  async function submitApprovals(
    body: ApprovalSubmission,
    signal?: AbortSignal
  ): Promise<Response> {
    const response = await fetch(`${baseURL}/chat/approvals`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal,
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Error ${response.status}: ${text || 'Error inesperado del servidor'}`)
    }
    return response
  }

  return {
    baseURL,
    getSessions,
    createSession,
    getSession,
    updateSession,
    deleteSession,
    getPendingApprovals,
    sendMessage,
    submitApprovals,
  }
}
