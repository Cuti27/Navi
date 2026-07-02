import type { LanguageModel } from "ai"
import type { ProviderName } from "../config/provider.js"

/**
 * Represents an AI provider that can create language models.
 *
 * Implementations are thin wrappers around the Vercel AI SDK. They create
 * a model instance that the rest of the application uses directly with
 * `streamText`, `generateText`, and other SDK functions.
 */
export interface AIProvider {
    /**
     * The name of the AI provider.
     */
    readonly name: ProviderName

    /**
     * Returns a Vercel AI SDK language model for the given model identifier.
     * @param modelId The provider-specific model identifier (e.g. "gpt-4o").
     */
    getModel(modelId: string): LanguageModel
}
