import type { MiddlewareHandler } from "hono"

export const masterAuth: MiddlewareHandler = async (c, next) => {
    const token = c.req.header("Authorization")?.replace("Bearer ", "")
    if (token !== process.env.MASTER_TOKEN) {
        return c.json({ error: "Unauthorized" }, 401)
    }
    await next()
}