import { test, expect } from '@playwright/test'

const SESSION_ID = '00000000-0000-0000-0000-000000000001'

test.describe('chat page', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([
      { name: 'navi-token', value: 'test-token', domain: 'localhost', path: '/' },
    ])
    await page.addInitScript(() => {
      localStorage.setItem('navi-token', 'test-token')
    })

    await page.route('**/api/v1/sessions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            id: SESSION_ID,
            title: 'Chat E2E',
            contextSummary: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          messages: [],
        }),
      })
    })
  })

  test('renders chat page with title and textarea', async ({ page }) => {
    await page.goto(`/chat/${SESSION_ID}`)
    await expect(page.locator('h1')).toContainText('Chat E2E')
    await expect(page.getByPlaceholder('Escribe un mensaje...')).toBeVisible()
  })

  test('sends message and streams response', async ({ page }) => {
    await page.route('**/api/v1/chat', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: [
          'data: "Hola, soy Navi"\n\n',
          'event: tool-approval-request\n',
          'data: {"approvalId":"a1","toolName":"test_tool","description":"¿Ejecutamos?"}\n\n',
          'event: done\n',
          'data: {"reason":"awaiting-approval","pendingCount":1}\n\n',
        ].join(''),
      })
    })

    await page.goto(`/chat/${SESSION_ID}`)
    await page.waitForTimeout(500)

    const textarea = page.getByPlaceholder('Escribe un mensaje...')
    await expect(textarea).toBeVisible()
    await textarea.fill('Hola')
    await textarea.press('Enter')

    await expect(page.getByText('soy Navi')).toBeVisible({ timeout: 8000 })
  })
})
