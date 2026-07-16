import { z, OpenAPIHono, createRoute } from "@hono/zod-openapi"
import type { ToolExecutor } from "../../mcp/tool-executor.js"

const ServiceStatusSchema = z.enum([
    "connecting",
    "connected",
    "error",
    "disabled",
])

const ActiveServiceSchema = z.object({
    name: z.string(),
    url: z.string().optional(),
    status: ServiceStatusSchema,
    tools: z.array(z.string()),
    error: z.string().optional(),
}).openapi("ActiveService")

const McpServicesResponseSchema = z.array(ActiveServiceSchema).openapi("McpServicesResponse")

const AvailableToolSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    serverName: z.string(),
    enabled: z.boolean(),
    readOnlyHint: z.boolean().optional(),
}).openapi("AvailableTool")

const McpToolsResponseSchema = z.array(AvailableToolSchema).openapi("McpToolsResponse")

const ToggleToolParamsSchema = z.object({
    name: z.string(),
}).openapi("ToggleToolParams")

const ToggleToolBodySchema = z.object({
    enabled: z.boolean(),
}).openapi("ToggleToolBody")

export function createMcpRoute(toolExecutor: ToolExecutor) {
    const app = new OpenAPIHono()

    const servicesRoute = createRoute({
        method: "get",
        path: "/mcp/services",
        responses: {
            200: {
                description: "List of configured MCP services and their status",
                content: {
                    "application/json": {
                        schema: McpServicesResponseSchema,
                    },
                },
            },
        },
    })

    app.openapi(servicesRoute, (c) => {
        return c.json(toolExecutor.getActiveServices())
    })

    const toolsRoute = createRoute({
        method: "get",
        path: "/mcp/tools",
        responses: {
            200: {
                description: "List of discovered tools and their enabled state",
                content: {
                    "application/json": {
                        schema: McpToolsResponseSchema,
                    },
                },
            },
        },
    })

    app.openapi(toolsRoute, (c) => {
        return c.json(toolExecutor.getAvailableTools())
    })

    const toggleRoute = createRoute({
        method: "patch",
        path: "/mcp/tools/:name",
        request: {
            params: ToggleToolParamsSchema,
            body: {
                content: {
                    "application/json": {
                        schema: ToggleToolBodySchema,
                    },
                },
            },
        },
        responses: {
            200: {
                description: "Tool enabled state updated",
                content: {
                    "application/json": {
                        schema: AvailableToolSchema,
                    },
                },
            },
            404: {
                description: "Tool not found",
            },
        },
    })

    app.openapi(toggleRoute, (c) => {
        const { name } = c.req.valid("param")
        const { enabled } = c.req.valid("json")

        try {
            toolExecutor.setToolEnabled(name, enabled)
        } catch {
            return c.json({ error: `Tool not found: ${name}` }, 404)
        }

        const tool = toolExecutor.getAvailableTools().find((t) => t.name === name)
        return c.json(tool!)
    })

    return app
}
