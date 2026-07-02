/**
 * Builds the system prompt injected into every LLM request.
 *
 * Implementations combine the static base prompt with dynamic context
 * such as current date/time and environment information.
 */
export interface SystemPromptBuilder {
    build(): string
}
