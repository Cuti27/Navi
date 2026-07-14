import '@testing-library/jest-dom/vitest'
import { afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './mock-server/handlers'

const server = setupServer(...handlers)

server.listen({ onUnhandledRequest: 'error' })

afterEach(() => server.resetHandlers())

afterAll(() => server.close())
