import type { MiddlewareHandler } from "hono"

const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
].join("; ")

export function createSecurityHeaders(): MiddlewareHandler {
    return async (c, next) => {
        await next()

        const contentType = c.res.headers.get("content-type")

        if (contentType && contentType.includes("text/event-stream")) {
            c.res.headers.set("X-Content-Type-Options", "nosniff")
            c.res.headers.set("X-Frame-Options", "DENY")
            c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
            return
        }

        c.res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
        c.res.headers.set("X-Content-Type-Options", "nosniff")
        c.res.headers.set("X-Frame-Options", "DENY")
        c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
        c.res.headers.set("Content-Security-Policy", CSP)
    }
}
