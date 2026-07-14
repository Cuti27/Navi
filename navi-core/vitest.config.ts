import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/__tests__/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",
        "src/**/types.ts",
        "src/mcp/mcp-types.ts",
        "src/mcp/tool-executor.ts",
        "src/providers/ai-provider.ts",
        "src/prompts/system-prompt-builder.ts",
        "src/**/*.test.ts",
        "src/**/__tests__/**",
        "src/test/**",
      ],
    },
  },
})
