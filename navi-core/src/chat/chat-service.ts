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

export interface ChatServiceOptions {
    provider: AIProvider
    modelId: string
    toolExecutor?: ToolExecutor
    systemPromptBuilder?: SystemPromptBuilder
    sessionRepository: SessionRepository
    messageRepository: MessageRepository
    approvalRepository: ApprovalRepository
    maxHistoryMessages?: number
}

export interface ApprovalResponseInput {
    approvalId: string
    approved: boolean
    reason?: string
}

const log = getLogger("chat")

export class ChatService {
    private readonly options: ChatServiceOptions

    constructor(options: ChatServiceOptions) {
        this.options = options
    }

    /**
     * Genera una respuesta en streaming para un mensaje de usuario dentro de una sesión.
     *
     * El flujo:
     * 1. Valida que la sesión existe.
     * 2. Carga los últimos N mensajes del historial.
     * 3. Persiste el mensaje del usuario.
     * 4. Llama a streamText con system prompt dinámico + historial + tools.
     * 5. Si el LLM genera tool calls, emite eventos de aprobación y pausa.
     * 6. Al terminar el stream, persiste los responseMessages del SDK.
     */
    async streamResponse(sessionId: string, userMessage: string): Promise<Response> {
        const { sessionRepository, messageRepository } = this.options

        const session = await sessionRepository.getById(sessionId)
        if (!session) {
            return new Response(JSON.stringify({ error: "Session not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            })
        }

        await messageRepository.create({
            id: randomUUID(),
            sessionId,
            role: "user",
            content: userMessage,
        })

        const messages = await this.loadMessages(sessionId)
        return this.createSseResponse(sessionId, messages)
    }

    /**
     * Lista las aprobaciones de tools pendientes para una sesión. Útil para que
     * el frontend recupere su estado tras una reconexión o reinicio del servidor.
     */
    async listPendingApprovals(sessionId: string) {
        return this.options.approvalRepository.listPendingBySession(sessionId)
    }

    /**
     * Reanuda la generación después de que el usuario responda a una o más
     * peticiones de aprobación de tools.
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

        const messages = await this.loadMessages(sessionId)
        return this.createSseResponse(sessionId, messages)
    }

    private async loadMessages(sessionId: string): Promise<ModelMessage[]> {
        const { messageRepository, maxHistoryMessages = 20 } = this.options
        const historyMessages = await messageRepository.listBySessionChronological(
            sessionId,
            maxHistoryMessages
        )
        return this.buildMessages(historyMessages)
    }

    private createSseResponse(sessionId: string, messages: ModelMessage[]): Response {
        const encoder = new TextEncoder()

        const sseStream = new ReadableStream({
            start: async (controller) => {
                try {
                    await this.runStream(sessionId, messages, controller, encoder)
                    controller.close()
                } catch (error) {
                    log.error({ err: error }, "stream failed")
                    controller.error(error)
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
        messages: ModelMessage[],
        controller: ReadableStreamDefaultController<Uint8Array>,
        encoder: TextEncoder
    ): Promise<void> {
        const { provider, modelId, toolExecutor, systemPromptBuilder, approvalRepository } =
            this.options

        const tools = await toolExecutor?.getEnabledTools()
        const toolsNames = tools ? Object.keys(tools) : []

        log.info({ toolsCount: toolsNames.length }, "tools passed to LLM")
        log.debug({ toolsNames }, "enabled tools")

        const system = systemPromptBuilder?.build()

        const result = streamText({
            model: provider.getModel(modelId),
            system,
            messages,
            tools,
            stopWhen: isStepCount(5),
            toolApproval: ({ toolCall }) => {
                if (toolExecutor?.isToolReadOnly(toolCall.toolName)) {
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

        for await (const part of result.fullStream) {
            this.handleStreamPart(
                part,
                controller,
                encoder,
                sessionId,
                pendingApprovals
            )
        }

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

        const responseMessages = await result.responseMessages
        await this.persistResponseMessages(sessionId, responseMessages)

        // Emit a terminator so the frontend knows why the stream closed.
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
            controller.enqueue(encoder.encode(`data: ${part.text}\n\n`))
            return
        }

        if (part.type === "tool-approval-request") {
            const { approvalId, toolCall, signature } = part
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

                if (message.role === "system") {
                    return { role: "system", content: message.content }
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
