import { test, expect } from '@playwright/test'

test.describe('login page', () => {
  test('renders the login form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Vincular con Navi')).toBeVisible()
    await expect(page.getByText('Token Maestro requerido')).toBeVisible()
    await expect(page.getByLabel('Token')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
  })

  test('redirects unauthenticated users from home to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/login')
    await expect(page.getByText('Vincular con Navi')).toBeVisible()
  })

  test('redirects unauthenticated users from chat to login', async ({ page }) => {
    await page.goto('/chat/123')
    await expect(page).toHaveURL('/login')
    await expect(page.getByText('Vincular con Navi')).toBeVisible()
  })
})
