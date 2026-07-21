import { test, expect } from '@playwright/test'

test.describe('playground page', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([
      { name: 'navi-token', value: 'test-token', domain: 'localhost', path: '/' },
    ])
    await page.addInitScript(() => {
      localStorage.setItem('navi-token', 'test-token')
    })
  })

  test('renders NaviFace and state buttons', async ({ page }) => {
    await page.goto('/playground')
    await expect(page.locator('svg.navi-face')).toBeVisible()
    await expect(page.locator('text=idle')).toBeVisible()
    await expect(page.locator('text=thinking')).toBeVisible()
    await expect(page.locator('text=tool-calling')).toBeVisible()
    await expect(page.locator('text=awaiting-approval')).toBeVisible()
    await expect(page.locator('text=error')).toBeVisible()
    await expect(page.locator('text=compacting')).toBeVisible()
  })

  test('switches state on button click', async ({ page }) => {
    await page.goto('/playground')
    const face = page.locator('svg.navi-face')

    await expect(face).toHaveClass(/is-idle/)
    await page.click('text=thinking')
    await expect(face).toHaveClass(/is-thinking/)
    await page.click('text=error')
    await expect(face).toHaveClass(/is-error/)
  })
})
