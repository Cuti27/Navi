import type { LanguageModel } from "ai"
import type { AIProvider } from "../../providers/ai-provider.js"
import { PROVIDER_OPENAI } from "../../config/provider.js"

export function createMockProvider(): AIProvider {
  return {
    name: PROVIDER_OPENAI,
    getModel(_modelId: string): LanguageModel {
      return {} as LanguageModel
    },
  }
}
