/**
 * Represents the current status of a configured MCP server.
 */
export interface ActiveService {
    name: string
    url: string
    status: "connecting" | "connected" | "error" | "disabled"
    tools: string[]
    error?: string
}

/**
 * Metadata about a tool discovered from an MCP server.
 */
export interface AvailableTool {
    name: string
    description?: string
    serverName: string
    enabled: boolean
}
