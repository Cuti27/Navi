import type { MiddlewareHandler } from "hono"
import { getMaxBodySize } from "../config/limits.js"

export function createBodySizeLimit(): MiddlewareHandler {
    const maxSize = getMaxBodySize()

    return async (c, next) => {
        const contentLength = c.req.header("content-length")

        if (contentLength) {
            const length = Number(contentLength)
            if (!isNaN(length) && length > maxSize) {
                return c.json(
                    {
                        error: "Payload Too Large",
                        message: `Request body exceeds the maximum size of ${maxSize} bytes`,
                    },
                    413
                )
            }
        }

        await next()
    }
}
