export type Role = 'user' | 'assistant' | 'system' | 'tool'

export interface Session {
  id: string
  title: string
  contextSummary: string | null
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  sessionId: string
  role: Role
  content: string
  imageUrl?: string | null
  toolCalls?: unknown
  parts?: unknown
  createdAt: string
}

export interface PendingApproval {
  id: string
  sessionId: string
  toolCallId: string
  toolName: string
  input: unknown
  description?: string | null
  status: 'pending' | 'approved' | 'denied'
  reason?: string | null
  signature?: string | null
  createdAt: string
}

export interface ApprovalResponse {
  approvalId: string
  approved: boolean
  reason?: string
}

export interface ApprovalSubmission {
  sessionId: string
  responses: ApprovalResponse[]
}

export interface TextDeltaEvent {
  type: 'text-delta'
  text: string
}

export interface ToolApprovalRequestEvent {
  type: 'tool-approval-request'
  approvalId: string
  toolCallId: string
  toolName: string
  input: unknown
  description: string
  signature?: string
}

export interface ToolResultEvent {
  type: 'tool-result'
  toolCallId: string
  toolName: string
  output: unknown
}

export interface ToolOutputDeniedEvent {
  type: 'tool-output-denied'
  toolCallId: string
}

export interface DoneEvent {
  type: 'done'
  reason: 'complete' | 'awaiting-approval'
  pendingCount: number
}

export type SseEvent =
  | TextDeltaEvent
  | ToolApprovalRequestEvent
  | ToolResultEvent
  | ToolOutputDeniedEvent
  | DoneEvent

export interface ApprovalPayload {
  approvalId: string
  toolCallId: string
  toolName: string
  description?: string
  input?: unknown
  signature?: string
  response?: ApprovalResponse
}

export interface ToolSummaryCall {
  toolName: string
  input?: unknown
}

export interface UIMessage {
  id: string
  role: 'user' | 'assistant' | 'tool-summary'
  content: string
  meta?: unknown
  createdAt?: string
}
