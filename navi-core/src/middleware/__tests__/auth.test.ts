import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Hono } from "hono"
import { masterAuth } from "../auth.js"

describe("masterAuth middleware", () => {
  let app: Hono

  beforeEach(() => {
    process.env.MASTER_TOKEN = "test-token"
    app = new Hono()
    app.use("*", masterAuth)
    app.get("/test", (c) => c.json({ ok: true }))
  })

  afterEach(() => {
    delete process.env.MASTER_TOKEN
  })

  it("allows requests with valid token", async () => {
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer test-token" },
    })
    expect(res.status).toBe(200)
  })

  it("rejects requests without token", async () => {
    const res = await app.request("/test")
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe("Unauthorized")
  })

  it("rejects requests with wrong token", async () => {
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer wrong-token" },
    })
    expect(res.status).toBe(401)
  })

  it("rejects requests when MASTER_TOKEN is not configured", async () => {
    delete process.env.MASTER_TOKEN
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer test-token" },
    })
    expect(res.status).toBe(401)
  })
})
