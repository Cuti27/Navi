import config from "../../mcp.config.json" with { type: "json" }

/**
 * Configuration for a single remote MCP server.
 */
export interface McpServerConfig {
    name: string
    enabled?: boolean
    url: string
    headers?: Record<string, string>
}

/**
 * Root MCP configuration loaded from mcp.config.json.
 */
export interface McpConfig {
    servers: McpServerConfig[]
}

export const mcpConfig: McpConfig = config
