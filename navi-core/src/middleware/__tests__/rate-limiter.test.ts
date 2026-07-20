import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Hono } from "hono"
import { createRateLimiter } from "../rate-limiter.js"

describe("rateLimiter middleware", () => {
    let app: Hono

    beforeEach(() => {
        process.env.RATE_LIMIT_MAX = "10"
        process.env.RATE_LIMIT_WINDOW_MS = "60000"
        app = new Hono()
        const limiter = createRateLimiter()
        app.use("/api/v1/*", limiter)
        app.get("/api/v1/test", (c) => c.json({ ok: true }))
        app.get("/health", (c) => c.json({ status: "ok" }))
    })

    afterEach(() => {
        delete process.env.RATE_LIMIT_MAX
        delete process.env.RATE_LIMIT_WINDOW_MS
    })

    it("allows requests within limit", async () => {
        for (let i = 0; i < 10; i++) {
            const res = await app.request("/api/v1/test")
            expect(res.status).toBe(200)
        }
    })

    it("returns 429 when limit exceeded", async () => {
        for (let i = 0; i < 10; i++) {
            await app.request("/api/v1/test")
        }
        const res = await app.request("/api/v1/test")
        expect(res.status).toBe(429)
        const body = await res.json()
        expect(body.error).toBe("Too many requests")
    })

    it("does not rate limit /health", async () => {
        process.env.RATE_LIMIT_MAX = "1"
        const localApp = new Hono()
        const limiter = createRateLimiter()
        localApp.use("/api/v1/*", limiter)
        localApp.get("/api/v1/test", (c) => c.json({ ok: true }))
        localApp.get("/health", (c) => c.json({ status: "ok" }))

        await localApp.request("/api/v1/test")
        const rateLimited = await localApp.request("/api/v1/test")
        expect(rateLimited.status).toBe(429)

        const healthRes = await localApp.request("/health")
        expect(healthRes.status).toBe(200)
    })
})
