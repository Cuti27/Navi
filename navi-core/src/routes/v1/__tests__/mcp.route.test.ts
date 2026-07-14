import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMcpRoute } from "../mcp.route.js"
import { createMockToolExecutor } from "../../../test/mocks/mcp-service.mock.js"

describe("createMcpRoute", () => {
  it("GET /mcp/services returns active services", async () => {
    const executor = createMockToolExecutor({
      getActiveServices: () => [
        { name: "svc1", url: "http://test", status: "connected", tools: ["tool1"] },
      ],
    })
    const app = createMcpRoute(executor)

    const res = await app.request("/mcp/services")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe("svc1")
  })

  it("GET /mcp/tools returns available tools", async () => {
    const executor = createMockToolExecutor({
      getAvailableTools: () => [
        { name: "tool1", serverName: "svc1", enabled: true },
      ],
    })
    const app = createMcpRoute(executor)

    const res = await app.request("/mcp/tools")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe("tool1")
  })

  it("PATCH /mcp/tools/:name toggles tool enabled state", async () => {
    const executor = createMockToolExecutor({
      setToolEnabled: vi.fn(),
      getAvailableTools: () => [
        { name: "tool1", serverName: "svc1", enabled: true },
      ],
    })
    const app = createMcpRoute(executor)

    const res = await app.request("/mcp/tools/tool1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    })
    expect(res.status).toBe(200)
    expect(executor.setToolEnabled).toHaveBeenCalledWith("tool1", false)
  })

  it("PATCH /mcp/tools/:name returns 404 for unknown tool", async () => {
    const executor = createMockToolExecutor({
      setToolEnabled: vi.fn(() => { throw new Error("Tool not found: unknown") }),
      getAvailableTools: () => [],
    })
    const app = createMcpRoute(executor)

    const res = await app.request("/mcp/tools/unknown", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    })
    expect(res.status).toBe(404)
  })
})
