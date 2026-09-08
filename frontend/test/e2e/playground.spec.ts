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

  test('renders NaviFaceV2 avatar by default', async ({ page }) => {
    await page.goto('/playground')
    await expect(page.locator('span.bs-avatar svg')).toBeVisible()
    await expect(page.locator('text=idle')).toBeVisible()
    await expect(page.locator('text=thinking')).toBeVisible()
    await expect(page.locator('text=tool-calling')).toBeVisible()
    await expect(page.locator('text=awaiting-approval')).toBeVisible()
    await expect(page.locator('text=error')).toBeVisible()
    await expect(page.locator('text=compacting')).toBeVisible()
  })

  test('renders NaviFace state buttons', async ({ page }) => {
    await page.goto('/playground')
    await page.click('button:has-text("v1")')
    await expect(page.locator('svg.navi-face')).toBeVisible()
  })

  test('switches NaviFace state on button click', async ({ page }) => {
    await page.goto('/playground')
    await page.click('button:has-text("v1")')
    const face = page.locator('svg.navi-face')

    await expect(face).toHaveClass(/is-idle/)
    await page.click('text=thinking')
    await expect(face).toHaveClass(/is-thinking/)
    await page.click('text=error')
    await expect(face).toHaveClass(/is-error/)
  })

  test('switches NaviFaceV2 state on button click', async ({ page }) => {
    await page.goto('/playground')
    const avatar = page.locator('span.bs-avatar svg')

    await page.click('text=thinking')
    await expect(avatar).toBeVisible()
    await page.click('text=awaiting-approval')
    await expect(avatar).toBeVisible()
    await page.click('text=error')
    await expect(avatar).toBeVisible()
  })
})
