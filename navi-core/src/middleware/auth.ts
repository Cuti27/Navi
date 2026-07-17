import { timingSafeEqual, createHmac, randomBytes } from "node:crypto"
import type { MiddlewareHandler } from "hono"

/**
 * Compare two strings in constant time by hashing them first.
 * This avoids leaking the expected token length through an early
 * length check and keeps the comparison timing-independent.
 */
function safeCompare(a: string, b: string): boolean {
    // A static, arbitrary key is sufficient here because we only need
    // equal-length digests for timingSafeEqual; HMAC prevents length
    // extension and normalizes the output size.
    const key = "navi-master-auth-compare"
    const hashA = createHmac("sha256", key).update(a).digest("hex")
    const hashB = createHmac("sha256", key).update(b).digest("hex")
    const bufA = Buffer.from(hashA)
    const bufB = Buffer.from(hashB)
    return timingSafeEqual(bufA, bufB)
}

export const masterAuth: MiddlewareHandler = async (c, next) => {
    const token = c.req.header("Authorization")?.replace("Bearer ", "")
    const masterToken = process.env.MASTER_TOKEN

    // Always compare against a dummy value when no master token is configured
    // so the failure path is indistinguishable from a wrong token.
    const expected = masterToken || randomBytes(32).toString("hex")

    if (!token || !safeCompare(token, expected)) {
        return c.json({ error: "Unauthorized" }, 401)
    }
    await next()
}