import { http, HttpResponse } from 'msw'

const baseURL = 'http://localhost:3000/api/v1'

export const handlers = [
  http.get(`${baseURL}/sessions`, () => {
    return HttpResponse.json([])
  }),

  http.post(`${baseURL}/sessions`, async ({ request }) => {
    const body = await request.json() as { title?: string }
    return HttpResponse.json(
      {
        id: crypto.randomUUID(),
        title: body.title ?? 'Nueva conversación',
        contextSummary: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { status: 201 },
    )
  }),

  http.get(`${baseURL}/sessions/:id`, () => {
    return HttpResponse.json({
      session: {
        id: crypto.randomUUID(),
        title: 'Test session',
        contextSummary: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      messages: [],
    })
  }),

  http.patch(`${baseURL}/sessions/:id`, async ({ request }) => {
    const body = await request.json() as { title?: string }
    return HttpResponse.json({
      id: crypto.randomUUID(),
      title: body.title ?? 'Updated',
      contextSummary: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }),

  http.delete(`${baseURL}/sessions/:id`, () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${baseURL}/chat/approvals`, ({ request }) => {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('sessionId')
    return HttpResponse.json([])
  }),
]
