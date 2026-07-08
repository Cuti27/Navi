import type { Tool } from "ai"
import { createMCPClient, type MCPClient } from "@ai-sdk/mcp"
import { getLogger } from "../logger/logger.js"
import type { McpServerConfig } from "./mcp-config.js"
import type { ActiveService, AvailableTool } from "./mcp-types.js"
import type { ToolExecutor } from "./tool-executor.js"

const log = getLogger("mcp")

interface ServerConnection {
    config: McpServerConfig
    client: MCPClient | null
    status: "connecting" | "connected" | "error" | "disabled"
    error?: string
    availableTools: AvailableTool[]
    enabledTools: Record<string, Tool> | null
    toolEnabledFlags: Map<string, boolean>
}

/**
 * Remote MCP tool executor.
 *
 * Connects to HTTP/SSE MCP servers, discovers their tools, and exposes them
 * to the LLM through the ToolExecutor interface. Tools can be enabled or
 * disabled individually at runtime (in memory).
 */
export class McpToolService implements ToolExecutor {
    private readonly connections: ServerConnection[] = []

    constructor(configs: McpServerConfig[]) {
        for (const config of configs) {
            this.connections.push({
                config,
                client: null,
                status: config.enabled === false ? "disabled" : "connecting",
                availableTools: [],
                enabledTools: null,
                toolEnabledFlags: new Map(),
            })
        }
    }

    async connect(): Promise<void> {
        for (const connection of this.connections) {
            void this.connectServer(connection)
        }
    }

    private async connectServer(connection: ServerConnection): Promise<void> {
        if (connection.status === "disabled") {
            return
        }

        try {
            const client = await createMCPClient({
                transport: {
                    type: "http",
                    url: connection.config.url,
                    headers: connection.config.headers,
                },
            })

            const listResult = await client.listTools()
            const convertedTools = await client.tools()

            connection.client = client
            connection.availableTools = listResult.tools.map((t) => ({
                name: t.name,
                description: t.description,
                serverName: connection.config.name,
                enabled: true,
                readOnlyHint: readOnlyHintFromAnnotations(t.annotations),
            }))
            connection.enabledTools = convertedTools as Record<string, Tool>

            for (const tool of listResult.tools) {
                connection.toolEnabledFlags.set(tool.name, true)
            }

            connection.status = "connected"
            log.info(
                {
                    server: connection.config.name,
                    toolsCount: connection.availableTools.length,
                    tools: connection.availableTools.map((t) => t.name),
                },
                "connected"
            )
        } catch (error) {
            connection.status = "error"
            connection.error = error instanceof Error ? error.message : String(error)
            log.error({ server: connection.config.name, err: connection.error }, "connection failed")
        }
    }

    getActiveServices(): ActiveService[] {
        return this.connections.map((connection) => ({
            name: connection.config.name,
            url: connection.config.url,
            status: connection.status,
            tools: connection.availableTools.map((tool) => tool.name),
            error: connection.error,
        }))
    }

    getAvailableTools(): AvailableTool[] {
        return this.connections.flatMap((connection) =>
            connection.availableTools.map((tool) => ({
                ...tool,
                enabled: connection.toolEnabledFlags.get(tool.name) ?? tool.enabled,
            }))
        )
    }

    async getEnabledTools(): Promise<Record<string, Tool>> {
        const result: Record<string, Tool> = {}

        for (const connection of this.connections) {
            if (connection.status !== "connected" || !connection.enabledTools) {
                continue
            }

            for (const [name, tool] of Object.entries(connection.enabledTools)) {
                if (connection.toolEnabledFlags.get(name) !== false) {
                    result[name] = tool
                }
            }
        }

        return result
    }

    setToolEnabled(name: string, enabled: boolean): void {
        for (const connection of this.connections) {
            if (connection.toolEnabledFlags.has(name)) {
                connection.toolEnabledFlags.set(name, enabled)
                return
            }
        }

        throw new Error(`Tool not found: ${name}`)
    }

    isToolReadOnly(name: string): boolean {
        for (const connection of this.connections) {
            const tool = connection.availableTools.find((t) => t.name === name)
            if (!tool) continue

            if (tool.readOnlyHint) return true
            if (connection.config.autoApproveTools?.includes(name)) return true
            return false
        }

        return false
    }
}

function readOnlyHintFromAnnotations(
    annotations: unknown
): boolean | undefined {
    if (
        annotations &&
        typeof annotations === "object" &&
        "readOnlyHint" in annotations
    ) {
        return Boolean(annotations.readOnlyHint)
    }
    return undefined
}
