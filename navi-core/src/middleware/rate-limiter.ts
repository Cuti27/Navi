import type { MiddlewareHandler } from "hono"
import { rateLimiter } from "hono-rate-limiter"

export function createRateLimiter(): MiddlewareHandler {
    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000
    const isProduction = process.env.NODE_ENV === "production"
    const max = Number(process.env.RATE_LIMIT_MAX) || (isProduction ? 100 : 1000)

    return rateLimiter({
        windowMs,
        limit: max,
        message: {
            error: "Too many requests",
            message: `Rate limit exceeded. Try again in ${Math.ceil(windowMs / 1000)} seconds.`,
        },
        statusCode: 429,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (c) => {
            const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
                || c.req.header("x-real-ip")
                || "unknown"
            return ip
        },
    })
}
