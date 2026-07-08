import config from "../../mcp.config.json" with { type: "json" }

/**
 * Configuration for a single remote MCP server.
 */
export interface McpServerConfig {
    name: string
    enabled?: boolean
    url: string
    headers?: Record<string, string>
    /**
     * Tool names that should be considered read-only and therefore auto-approved.
     * Useful when the MCP server does not publish `annotations.readOnlyHint`.
     */
    autoApproveTools?: string[]
}

/**
 * Root MCP configuration loaded from mcp.config.json.
 */
export interface McpConfig {
    servers: McpServerConfig[]
}

export const mcpConfig: McpConfig = config
