import { describe, it, expect, beforeEach } from "vitest"
import { Hono } from "hono"
import { createSecurityHeaders } from "../security-headers.js"

describe("securityHeaders middleware", () => {
    let app: Hono

    beforeEach(() => {
        app = new Hono()
        app.use("/api/v1/*", createSecurityHeaders())
        app.get("/api/v1/sessions", (c) => c.json({ data: "test" }))
        app.get("/api/v1/stream", (c) => {
            return new Response("data: hello\n\n", {
                headers: { "Content-Type": "text/event-stream" },
            })
        })
    })

    it("sets Strict-Transport-Security header", async () => {
        const res = await app.request("/api/v1/sessions")
        expect(res.headers.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains; preload")
    })

    it("sets X-Content-Type-Options header", async () => {
        const res = await app.request("/api/v1/sessions")
        expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff")
    })

    it("sets X-Frame-Options header", async () => {
        const res = await app.request("/api/v1/sessions")
        expect(res.headers.get("X-Frame-Options")).toBe("DENY")
    })

    it("sets Referrer-Policy header", async () => {
        const res = await app.request("/api/v1/sessions")
        expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin")
    })

    it("sets Content-Security-Policy header", async () => {
        const res = await app.request("/api/v1/sessions")
        const csp = res.headers.get("Content-Security-Policy")
        expect(csp).toBeTruthy()
        expect(csp).toContain("default-src 'self'")
        expect(csp).toContain("script-src 'self'")
        expect(csp).toContain("style-src 'self' 'unsafe-inline'")
    })

    it("does not break SSE responses", async () => {
        const res = await app.request("/api/v1/stream")
        expect(res.status).toBe(200)
        expect(res.headers.get("Content-Type")).toBe("text/event-stream")
        expect(res.headers.get("Content-Security-Policy")).toBeNull()
        expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff")
    })
})
