export const PROVIDER_OPENAI = 'openai'
export const PROVIDER_ANTHROPIC = 'anthropic'
export const PROVIDER_OPENCODE = 'opencode'

export const SUPPORTED_PROVIDERS = [
    PROVIDER_OPENAI,
    PROVIDER_ANTHROPIC,
    PROVIDER_OPENCODE
] as const

export type ProviderName = typeof SUPPORTED_PROVIDERS[number]