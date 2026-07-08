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
    /**
     * Whether the tool claims to be read-only according to the MCP server
     * annotations. Falls back to false when the server does not publish it.
     */
    readOnlyHint?: boolean
}
