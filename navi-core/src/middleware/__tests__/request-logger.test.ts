import { describe, it, expect } from "vitest"
import { Hono } from "hono"
import { requestLogger } from "../request-logger.js"

describe("requestLogger middleware", () => {
  it("calls next and does not block the response", async () => {
    const app = new Hono()
    app.use("*", requestLogger)
    app.get("/test", (c) => c.json({ ok: true }))

    const res = await app.request("/test")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
