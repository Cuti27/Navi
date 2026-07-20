import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Hono } from "hono"
import { createBodySizeLimit } from "../body-size-limit.js"

describe("bodySizeLimit middleware", () => {
    let app: Hono

    beforeEach(() => {
        process.env.MAX_BODY_SIZE = "100"
        app = new Hono()
        const bodyLimit = createBodySizeLimit()
        app.use("/api/v1/*", bodyLimit)
        app.post("/api/v1/test", async (c) => {
            const body = await c.req.json()
            return c.json({ received: body })
        })
    })

    afterEach(() => {
        delete process.env.MAX_BODY_SIZE
    })

    it("allows requests within size limit", async () => {
        const res = await app.request("/api/v1/test", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": "15" },
            body: JSON.stringify({ hello: "world" }),
        })
        expect(res.status).toBe(200)
    })

    it("returns 413 when body exceeds limit", async () => {
        const bigBody = "x".repeat(101)
        const res = await app.request("/api/v1/test", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": "101" },
            body: bigBody,
        })
        expect(res.status).toBe(413)
        const body = await res.json()
        expect(body.error).toBe("Payload Too Large")
    })

    it("allows requests without content-length header", async () => {
        const res = await app.request("/api/v1/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ small: "data" }),
        })
        expect(res.status).toBe(200)
    })
})
