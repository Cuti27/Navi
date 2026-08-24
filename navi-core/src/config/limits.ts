/**
 * Shared size/duration limits. Read lazily so tests can vary them via env.
 */

export function getMaxBodySize(): number {
    return Number(process.env.MAX_BODY_SIZE) || 10 * 1024 * 1024
}

export function getMaxAudioSeconds(): number {
    return Number(process.env.MAX_AUDIO_SECONDS) || 120
}