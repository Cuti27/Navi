import type { MiddlewareHandler } from "hono"

export function createBodySizeLimit(): MiddlewareHandler {
    const maxSize = Number(process.env.MAX_BODY_SIZE) || 1_048_576

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
