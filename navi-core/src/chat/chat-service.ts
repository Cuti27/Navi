import { randomUUID } from "node:crypto"
import {
    streamText,
    isStepCount,
    type Tool,
    type ModelMessage,
    type TextStreamPart,
} from "ai"
import type { AIProvider } from "../providers/ai-provider.js"
import type { ToolExecutor } from "../mcp/tool-executor.js"
import type { SystemPromptBuilder } from "../prompts/system-prompt-builder.js"
import type { SessionRepository } from "../db/repositories/session.repository.js"
import type { MessageRepository } from "../db/repositories/message.repository.js"
import type { ApprovalRepository } from "../db/repositories/approval.repository.js"
import type { Message, NewMessage } from "../db/schema.js"
import { getLogger } from "../logger/logger.js"
import type { CompactionService } from "./compaction-service.js"
import type { MemoryContextBuilder } from "../memory/memory-context.js"
import { mcpConfig } from "../mcp/mcp-config.js"

export interface ChatServiceOptions {
    provider: AIProvider
    modelId: string
    toolExecutor?: ToolExecutor
    systemPromptBuilder?: SystemPromptBuilder
    sessionRepository: SessionRepository
    messageRepository: MessageRepository
    approvalRepository: ApprovalRepository
    compactionService?: CompactionService
    memoryTools?: Record<string, Tool>
    readOnlyToolNames?: Set<string>
    memoryContextBuilder?: MemoryContextBuilder
    maxHistoryMessages?: number
}

export interface ApprovalResponseInput {
    approvalId: string
    approved: boolean
    reason?: string
}

const log = getLogger("chat")

const MCP_AUTO_APPROVED_TOOLS = new Set(
    mcpConfig.servers.flatMap((server) => server.autoApproveTools ?? [])
)

export class ChatService {
    private readonly options: ChatServiceOptions

    constructor(options: ChatServiceOptions) {
        this.options = options
    }

    /**
     * Generates a streaming response for a user message within a session.
     *
     * The flow:
     * 1. Validates the session exists.
     * 2. Loads the last N messages from history.
     * 3. Persists the user message.
     * 4. Calls streamText with dynamic system prompt + history + tools.
     * 5. If the LLM generates tool calls, emits approval events and pauses.
     * 6. Upon stream completion, persists the SDK responseMessages.
     */
    async streamResponse(
        sessionId: string,
        userMessage: string,
        cancelPendingApprovals = false
    ): Promise<Response> {
        const { sessionRepository, messageRepository, approvalRepository, compactionService } =
            this.options

        const session = await sessionRepository.getById(sessionId)
        if (!session) {
            return new Response(JSON.stringify({ error: "Session not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            })
        }

        // If the user starts a new message while tool approvals are pending,
        // deny them and record the tools as cancelled. This keeps the message
        // history valid for the LLM.
        if (cancelPendingApprovals && approvalRepository) {
            await this.denyAllPendingApprovals(sessionId, approvalRepository, messageRepository)
        }

        // Guard against race conditions where the user sends a new message
        // before the previous tool results were recorded. Without this, the
        // provider receives an assistant message with tool_calls but no
        // matching tool results, which causes a 400 invalid_request_error.
        await this.sanitizeHangingToolCalls(sessionId, messageRepository)

        await messageRepository.create({
            id: randomUUID(),
            sessionId,
            role: "user",
            content: userMessage,
        })

        await compactionService?.checkAndCompact(sessionId)

        const context = await this.buildContext(sessionId)
        return this.createSseResponse(sessionId, context)
    }

    private async denyAllPendingApprovals(
        sessionId: string,
        approvalRepository: ApprovalRepository,
        messageRepository: MessageRepository
    ): Promise<void> {
        const pending = await approvalRepository.listPendingBySession(sessionId)
        if (pending.length === 0) return

        for (const approval of pending) {
            await approvalRepository.updateStatus(approval.id, "denied", "Usuario canceló la acción")
        }

        await this.injectToolResultErrors(
            sessionId,
            pending.map((approval) => ({
                toolCallId: approval.toolCallId,
                toolName: approval.toolName,
            })),
            messageRepository,
            "Usuario canceló la acción"
        )

        log.info({ sessionId, count: pending.length }, "pending approvals denied by new user message")
    }

    private async sanitizeHangingToolCalls(
        sessionId: string,
        messageRepository: MessageRepository
    ): Promise<void> {
        const history = await messageRepository.listAllBySessionChronological(sessionId)
        const unresolved = this.findUnresolvedToolCalls(history)
        if (unresolved.length === 0) return

        log.warn({ sessionId, count: unresolved.length }, "sanitizing hanging tool calls")
        await this.injectToolResultErrors(
            sessionId,
            unresolved,
            messageRepository,
            "La llamada a la herramienta fue interrumpida por un nuevo mensaje"
        )
    }

    private findUnresolvedToolCalls(history: Message[]): Array<{ toolCallId: string; toolName: string }> {
        const resolvedIds = new Set<string>()
        const seen: Array<{ toolCallId: string; toolName: string }> = []

        for (const message of history) {
            if (message.role === "assistant" && Array.isArray(message.toolCalls)) {
                for (const toolCall of message.toolCalls) {
                    const tc = toolCall as { toolCallId?: string; id?: string; toolName?: string; name?: string }
                    const toolCallId = tc.toolCallId ?? tc.id
                    if (toolCallId) {
                        seen.push({ toolCallId, toolName: tc.toolName ?? tc.name ?? "unknown" })
                    }
                }
            }

            if (message.role === "tool" && Array.isArray(message.parts)) {
                for (const part of message.parts) {
                    const p = part as { toolCallId?: string }
                    if (p?.toolCallId) resolvedIds.add(p.toolCallId)
                }
            }
        }

        return seen.filter((toolCall) => !resolvedIds.has(toolCall.toolCallId))
    }

    private async injectToolResultErrors(
        sessionId: string,
        toolCalls: Array<{ toolCallId: string; toolName: string }>,
        messageRepository: MessageRepository,
        reason: string
    ): Promise<void> {
        if (toolCalls.length === 0) return

        const parts = toolCalls.map((toolCall) => ({
            type: "tool-result" as const,
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            output: { error: reason },
        }))

        await messageRepository.create({
            id: randomUUID(),
            sessionId,
            role: "tool",
            content: JSON.stringify(parts),
            parts: parts as unknown as NewMessage["parts"],
        })
    }

    /**
     * Lists pending tool approvals for a session. Useful for the frontend
     * to recover its state after a reconnection or server restart.
     */
    async listPendingApprovals(sessionId: string) {
        return this.options.approvalRepository.listPendingBySession(sessionId)
    }

    /**
     * Resumes generation after the user responds to one or more
     * tool approval requests.
     */

    async streamApprovalResponse(
        sessionId: string,
        responses: ApprovalResponseInput[]
    ): Promise<Response> {
        const { sessionRepository, approvalRepository, messageRepository } = this.options

        const session = await sessionRepository.getById(sessionId)
        if (!session) {
            return new Response(JSON.stringify({ error: "Session not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            })
        }

        if (responses.length === 0) {
            return new Response(JSON.stringify({ error: "No approval responses provided" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            })
        }

        const approvalResponseParts: Array<{
            type: "tool-approval-response"
            approvalId: string
            approved: boolean
            reason?: string
        }> = []

        const pendingBefore = await approvalRepository.listPendingBySession(sessionId)
        const providedIds = new Set(responses.map((r) => r.approvalId))
        const missingPending = pendingBefore.filter((a) => !providedIds.has(a.id))
        if (missingPending.length > 0) {
            return new Response(
                JSON.stringify({
                    error: "All pending tool approvals must be answered in the same request",
                    missingApprovalIds: missingPending.map((a) => a.id),
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            )
        }

        for (const response of responses) {
            const approval = await approvalRepository.getById(response.approvalId)
            if (!approval || approval.sessionId !== sessionId) {
                return new Response(
                    JSON.stringify({ error: `Approval not found: ${response.approvalId}` }),
                    { status: 404, headers: { "Content-Type": "application/json" } }
                )
            }
            if (approval.status !== "pending") {
                return new Response(
                    JSON.stringify({
                        error: `Approval ${response.approvalId} is already ${approval.status}`,
                    }),
                    { status: 409, headers: { "Content-Type": "application/json" } }
                )
            }

            await approvalRepository.updateStatus(
                response.approvalId,
                response.approved ? "approved" : "denied",
                response.reason
            )

            approvalResponseParts.push({
                type: "tool-approval-response",
                approvalId: response.approvalId,
                approved: response.approved,
                reason: response.reason,
            })
        }

        await messageRepository.create({
            id: randomUUID(),
            sessionId,
            role: "tool",
            content: JSON.stringify(approvalResponseParts),
            parts: approvalResponseParts as unknown as NewMessage["parts"],
        })

        log.info(
            { sessionId, responsesCount: responses.length },
            "approval responses recorded, resuming stream"
        )

        const context = await this.buildContext(sessionId)
        return this.createSseResponse(sessionId, context)
    }

    private async buildContext(sessionId: string): Promise<{ system: string; messages: ModelMessage[] }> {
        const { messageRepository, sessionRepository, maxHistoryMessages = 20, memoryContextBuilder } =
            this.options

        const session = await sessionRepository.getById(sessionId)
        const historyMessages = await messageRepository.listBySessionChronological(
            sessionId,
            maxHistoryMessages
        )
        const coreMessages = this.buildMessages(historyMessages)

        const systemParts: string[] = []

        if (session?.contextSummary) {
            systemParts.push(`## Resumen previo de la conversación\n\n${session.contextSummary}`)
        }

        if (memoryContextBuilder) {
            const lastUserMessage = [...historyMessages].reverse().find((m) => m.role === "user")
            if (lastUserMessage) {
                const memoryContext = await memoryContextBuilder.build(lastUserMessage.content)
                if (memoryContext) {
                    systemParts.push(memoryContext)
                }
            }
        }

        return { system: systemParts.join("\n\n"), messages: coreMessages }
    }

    private createSseResponse(
        sessionId: string,
        context: { system: string; messages: ModelMessage[] }
    ): Response {
        const encoder = new TextEncoder()

        const sseStream = new ReadableStream({
            start: async (controller) => {
                let runResult: { responseMessages: PromiseLike<ModelMessage[]> } | undefined
                try {
                    runResult = await this.runStream(sessionId, context, controller, encoder)
                    log.info("runStream completed, closing controller")
                    controller.close()
                    log.info("SSE controller closed")
                } catch (error) {
                    log.error({ err: error }, "stream failed")
                    controller.error(error)
                    return
                }

                // Persist after closing the stream so the client is never blocked
                // if the provider's responseMessages promise hangs.
                if (!runResult) return
                try {
                    const responseMessages = await Promise.race([
                        runResult.responseMessages,
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error("responseMessages timeout")), 60000)
                        ),
                    ])
                    await this.persistResponseMessages(sessionId, responseMessages)
                    log.info("response messages persisted")
                } catch (err) {
                    log.error({ err }, "failed to persist response messages")
                }
            },
        })

        return new Response(sseStream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
            },
        })
    }

    private async runStream(
        sessionId: string,
        context: { system: string; messages: ModelMessage[] },
        controller: ReadableStreamDefaultController<Uint8Array>,
        encoder: TextEncoder
    ): Promise<{ responseMessages: PromiseLike<ModelMessage[]> }> {
        const {
            provider,
            modelId,
            toolExecutor,
            systemPromptBuilder,
            approvalRepository,
            memoryTools,
            readOnlyToolNames,
        } = this.options

        const mcpTools = (await toolExecutor?.getEnabledTools()) ?? {}
        const tools: Record<string, Tool> = { ...mcpTools, ...(memoryTools ?? {}) }
        const toolsNames = Object.keys(tools)

        log.info({ toolsCount: toolsNames.length }, "tools passed to LLM")
        log.debug({ toolsNames }, "enabled tools")

        const systemParts = [systemPromptBuilder?.build(), context.system].filter(Boolean)
        const system = systemParts.join("\n\n")

        const result = streamText({
            model: provider.getModel(modelId),
            system,
            messages: context.messages,
            tools,
            stopWhen: isStepCount(5),
            toolApproval: ({ toolCall }) => {
                if (
                    MCP_AUTO_APPROVED_TOOLS.has(toolCall.toolName) ||
                    toolExecutor?.isToolReadOnly(toolCall.toolName) ||
                    readOnlyToolNames?.has(toolCall.toolName)
                ) {
                    log.debug({ tool: toolCall.toolName }, "auto-approving read-only tool")
                    return "approved"
                }
                log.debug({ tool: toolCall.toolName }, "requesting user approval")
                return "user-approval"
            },
            onStepStart: ({ stepNumber }) => {
                log.debug({ stepNumber }, "step started")
            },
            onStepEnd: ({ stepNumber, finishReason, text, toolCalls, toolResults }) => {
                const textLength = text.length
                log.info({ stepNumber, finishReason, textLength }, "step finished")

                if (toolCalls && toolCalls.length > 0) {
                    log.info(
                        {
                            toolCalls: toolCalls.map((tc) =>
                                typeof tc.toolName === "string" ? tc.toolName : "unknown"
                            ),
                        },
                        "tool calls generated"
                    )
                }

                if (toolResults && toolResults.length > 0) {
                    log.debug(
                        {
                            toolResults: toolResults.map((tr) =>
                                typeof tr.toolName === "string" ? tr.toolName : "unknown"
                            ),
                        },
                        "tool results received"
                    )
                }
            },
            onToolExecutionStart: ({ toolCall }) => {
                log.info({ tool: toolCall.toolName, input: toolCall.input }, "executing tool")
            },
            onToolExecutionEnd: ({ toolCall, toolExecutionMs, toolOutput }) => {
                log.info(
                    { tool: toolCall.toolName, durationMs: toolExecutionMs },
                    "tool execution finished"
                )
                log.debug({ tool: toolCall.toolName, output: toolOutput }, "tool result")
            },
            onError: ({ error }) => {
                log.error({ err: error }, "stream error")
            },
        })

        const pendingApprovals: Array<{
            id: string
            sessionId: string
            toolCallId: string
            toolName: string
            input: unknown
            description: string
            signature?: string
        }> = []

        const iterator = result.fullStream[Symbol.asyncIterator]()
        const INACTIVITY_MS = 30000
        let chunkCount = 0
        log.info("starting fullStream consumption")
        while (true) {
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(
                    () => reject(new Error(`fullStream inactive for ${INACTIVITY_MS}ms`)),
                    INACTIVITY_MS
                )
            })
            let next: IteratorResult<TextStreamPart<Record<string, Tool>>, unknown>
            try {
                next = await Promise.race([iterator.next(), timeoutPromise])
            } catch (err) {
                log.warn({ err, chunkCount }, "fullStream inactivity timeout, closing stream")
                await iterator.return?.().catch(() => {})
                break
            }
            if (next.done) {
                log.info({ chunkCount }, "fullStream iterator done")
                break
            }
            chunkCount++
            this.handleStreamPart(
                next.value,
                controller,
                encoder,
                sessionId,
                pendingApprovals
            )
        }

        log.info({ chunkCount }, "fullStream consumed")

        // Persist pending approval rows so the frontend can respond later.
        for (const approval of pendingApprovals) {
            await approvalRepository.create({
                id: approval.id,
                sessionId: approval.sessionId,
                toolCallId: approval.toolCallId,
                toolName: approval.toolName,
                input: approval.input as NewMessage["parts"],
                description: approval.description,
                signature: approval.signature,
                status: "pending",
            })
        }

        // Emit a terminator immediately so the frontend can close the stream.
        // Persisting responseMessages is done after closing the SSE connection
        // to avoid blocking the client if the provider hangs on finishing the stream.
        const doneReason = pendingApprovals.length > 0 ? "awaiting-approval" : "complete"
        controller.enqueue(
            encoder.encode(
                `event: done\ndata: ${JSON.stringify({
                    reason: doneReason,
                    pendingCount: pendingApprovals.length,
                })}\n\n`
            )
        )

        log.info(
            { reason: doneReason, pendingCount: pendingApprovals.length },
            "stream finished"
        )

        return { responseMessages: result.responseMessages as PromiseLike<ModelMessage[]> }
    }

    private handleStreamPart(
        part: TextStreamPart<Record<string, Tool>>,
        controller: ReadableStreamDefaultController<Uint8Array>,
        encoder: TextEncoder,
        sessionId: string,
        pendingApprovals: Array<{
            id: string
            sessionId: string
            toolCallId: string
            toolName: string
            input: unknown
            description: string
            signature?: string
        }>
    ): void {
        if (part.type === "text-delta") {
            log.trace({ text: part.text, hasSpace: part.text.includes(" ") }, "text-delta")
            controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(part.text)}\n\n`)
            )
            return
        }

        if (part.type === "tool-approval-request") {
            const { approvalId, toolCall, signature, isAutomatic } = part

            // Auto-approved tools (read-only / explicitly allowed) still emit a
            // tool-approval-request from the SDK with isAutomatic: true. We must
            // not forward those to the UI or persist them as pending approvals.
            if (isAutomatic) {
                log.debug(
                    { approvalId, tool: toolCall.toolName },
                    "skipping automatic tool approval request"
                )
                return
            }

            const description = `Navi quiere ejecutar '${toolCall.toolName}'`

            const payload = {
                approvalId,
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                input: toolCall.input,
                description,
                signature,
            }

            controller.enqueue(
                encoder.encode(
                    `event: tool-approval-request\ndata: ${JSON.stringify(payload)}\n\n`
                )
            )

            pendingApprovals.push({
                id: approvalId,
                sessionId,
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                input: toolCall.input,
                description,
                signature,
            })

            log.info(
                { approvalId, tool: toolCall.toolName, input: toolCall.input },
                "tool approval requested"
            )
            return
        }

        if (part.type === "tool-result") {
            controller.enqueue(
                encoder.encode(
                    `event: tool-result\ndata: ${JSON.stringify({
                        toolCallId: part.toolCallId,
                        toolName: part.toolName,
                        output: part.output,
                    })}\n\n`
                )
            )
            return
        }

        if (part.type === "tool-output-denied") {
            controller.enqueue(
                encoder.encode(
                    `event: tool-output-denied\ndata: ${JSON.stringify({
                        toolCallId: part.toolCallId,
                    })}\n\n`
                )
            )
            return
        }

        // Other part types (reasoning, sources, step events, etc.) are ignored
        // in the SSE contract for the MVP.
    }

    private async persistResponseMessages(
        sessionId: string,
        responseMessages: ModelMessage[]
    ): Promise<void> {
        const { messageRepository } = this.options

        for (const msg of responseMessages) {
            const id = randomUUID()

            if (msg.role === "assistant") {
                const parts = Array.isArray(msg.content) ? msg.content : undefined
                const text = typeof msg.content === "string" ? msg.content : extractText(parts)
                const toolCalls = parts?.filter((p) => p.type === "tool-call")

                await messageRepository.create({
                    id,
                    sessionId,
                    role: "assistant",
                    content: text,
                    parts: parts as unknown as NewMessage["parts"],
                    toolCalls: toolCalls as unknown as NewMessage["toolCalls"],
                })

                log.debug({ messageId: id, role: msg.role, textLength: text.length }, "persisted assistant message")
                continue
            }

            if (msg.role === "tool") {
                const parts = Array.isArray(msg.content) ? msg.content : undefined
                const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)

                await messageRepository.create({
                    id,
                    sessionId,
                    role: "tool",
                    content: text,
                    parts: parts as unknown as NewMessage["parts"],
                })

                log.debug({ messageId: id, role: msg.role }, "persisted tool message")
                continue
            }

            log.warn({ role: msg.role }, "unexpected response message role, skipping persistence")
        }
    }

    private buildMessages(history: Message[]): ModelMessage[] {
        return history
            .map((message): ModelMessage | undefined => {
                if (message.role === "user") {
                    return { role: "user", content: message.content }
                }

                // System messages are not allowed in the messages array in ai SDK v7+.
                // They are combined into the instructions/system prompt in buildContext.
                if (message.role === "system") {
                    return undefined
                }

                // Use structured parts when available; fall back to the legacy
                // text column for rows created before HITL.
                if (message.parts) {
                    if (message.role === "assistant") {
                        return { role: "assistant", content: message.parts as never }
                    }
                    if (message.role === "tool") {
                        return { role: "tool", content: message.parts as never }
                    }
                }

                if (message.role === "assistant") {
                    return { role: "assistant", content: message.content }
                }

                // Legacy tool rows without structured parts: try to parse the
                // content as JSON parts; otherwise drop them from the history
                // because a tool message cannot contain plain text.
                const parsed = parseToolContentParts(message.content)
                if (parsed) {
                    return { role: "tool", content: parsed as never }
                }

                log.warn({ messageId: message.id }, "dropping legacy tool message without parseable parts")
                return undefined
            })
            .filter((m): m is ModelMessage => m !== undefined)
    }
}

function parseToolContentParts(content: string): unknown[] | undefined {
    try {
        const parsed = JSON.parse(content)
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed
        }
    } catch {
        // not JSON
    }
    return undefined
}

function extractText(parts: unknown[] | undefined): string {
    if (!Array.isArray(parts)) return ""
    return parts
        .filter((p): p is { type: "text"; text: string } =>
            typeof p === "object" &&
            p !== null &&
            "type" in p &&
            (p as { type: string }).type === "text" &&
            "text" in p &&
            typeof (p as { text: unknown }).text === "string"
        )
        .map((p) => p.text)
        .join("")
}
