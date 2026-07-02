import { AsyncLocalStorage } from "node:async_hooks"
import pino from "pino"

/**
 * Root pino logger instance.
 *
 * In development, pino-pretty is used for human-readable output.
 * In production, logs are emitted as JSON to stdout for collection.
 */
export const logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    transport:
        process.env.NODE_ENV === "production"
            ? undefined
            : {
                  target: "pino-pretty",
                  options: {
                      translateTime: "HH:MM:ss.l",
                      ignore: "pid,hostname",
                  },
              },
})

/**
 * AsyncLocalStorage store that propagates request context (e.g. reqId)
 * through the async call stack without explicit parameter passing.
 */
export const requestContext = new AsyncLocalStorage<{ reqId: string }>()

/**
 * Returns a child logger bound to a module name and, when available,
 * the current request ID.
 */
export function getLogger(module: string) {
    const reqId = requestContext.getStore()?.reqId
    return reqId ? logger.child({ module, reqId }) : logger.child({ module })
}
