import { randomUUID } from "node:crypto"
import type { MiddlewareHandler } from "hono"
import { getLogger, requestContext } from "../logger/logger.js"

/**
 * Hono middleware that assigns a request ID to every incoming request,
 * runs the rest of the pipeline inside an AsyncLocalStorage context,
 * and logs the completed request with method, path, status and duration.
 */
export const requestLogger: MiddlewareHandler = async (c, next) => {
    const reqId = randomUUID().slice(0, 8)
    const start = Date.now()

    await requestContext.run({ reqId }, async () => {
        await next()
    })

    const duration = Date.now() - start
    // Intentionally avoid logging headers or bodies to prevent leaking the
    // Authorization token or any user content.
    getLogger("http").info(
        {
            method: c.req.method,
            path: c.req.path,
            status: c.res.status,
            duration_ms: duration,
        },
        "request completed"
    )
}
