import { describe, it, expect } from "vitest"
import { mcpConfig } from "../mcp-config.js"

describe("mcpConfig", () => {
  it("has a servers array", () => {
    expect(Array.isArray(mcpConfig.servers)).toBe(true)
  })

  it("each server has name and url", () => {
    for (const server of mcpConfig.servers) {
      expect(typeof server.name).toBe("string")
      expect(server.name.length).toBeGreaterThan(0)
      expect(typeof server.url).toBe("string")
      expect(server.url.length).toBeGreaterThan(0)
    }
  })

  it("autoApproveTools is an array when present", () => {
    for (const server of mcpConfig.servers) {
      if (server.autoApproveTools) {
        expect(Array.isArray(server.autoApproveTools)).toBe(true)
      }
    }
  })
})
