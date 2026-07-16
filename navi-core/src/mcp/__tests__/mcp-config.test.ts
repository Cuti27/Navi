import { describe, it, expect } from "vitest"
import { mcpConfig, expandEnvVars, loadMcpConfig } from "../mcp-config.js"

describe("expandEnvVars", () => {
  it("replaces ${VAR} placeholders with environment variable values", () => {
    process.env.TEST_EXA_KEY = "exa_test_123"
    const result = expandEnvVars("Bearer ${TEST_EXA_KEY}")
    expect(result).toBe("Bearer exa_test_123")
    delete process.env.TEST_EXA_KEY
  })

  it("leaves missing variables unchanged", () => {
    const result = expandEnvVars("Bearer ${MISSING_VAR}")
    expect(result).toBe("Bearer ${MISSING_VAR}")
  })

  it("expands variables inside nested objects and arrays", () => {
    process.env.TEST_ARG = "--verbose"
    const result = expandEnvVars({
      args: ["${TEST_ARG}"],
      headers: { Authorization: "Bearer ${TEST_ARG}" },
    })
    expect(result).toEqual({
      args: ["--verbose"],
      headers: { Authorization: "Bearer --verbose" },
    })
    delete process.env.TEST_ARG
  })
})

describe("mcpConfig", () => {
  it("has a servers array", () => {
    expect(Array.isArray(mcpConfig.servers)).toBe(true)
  })

  it("each server has a valid transport configuration", () => {
    for (const server of mcpConfig.servers) {
      expect(typeof server.name).toBe("string")
      expect(server.name.length).toBeGreaterThan(0)

      const transport = server.transport ?? "http"
      if (transport === "stdio") {
        expect(typeof server.command).toBe("string")
        expect(server.command!.length).toBeGreaterThan(0)
      } else {
        expect(typeof server.url).toBe("string")
        expect(server.url!.length).toBeGreaterThan(0)
      }
    }
  })

  it("autoApproveTools is an array when present", () => {
    for (const server of mcpConfig.servers) {
      if (server.autoApproveTools) {
        expect(Array.isArray(server.autoApproveTools)).toBe(true)
      }
    }
  })

  it("loads configuration from disk and expands env vars", () => {
    const originalKey = process.env.EXA_API_KEY
    process.env.EXA_API_KEY = "exa_live_key"
    try {
      const config = loadMcpConfig()
      const exa = config.servers.find((s) => s.name === "exa")
      expect(exa).toBeDefined()
      expect(exa?.headers?.Authorization).toBe("Bearer exa_live_key")
    } finally {
      if (originalKey === undefined) {
        delete process.env.EXA_API_KEY
      } else {
        process.env.EXA_API_KEY = originalKey
      }
    }
  })
})
