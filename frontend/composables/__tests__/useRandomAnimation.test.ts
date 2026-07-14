import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useRandomAnimation } from '../useRandomAnimation'

describe('useRandomAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts inactive', () => {
    const { active } = useRandomAnimation(100, 200, 10)
    expect(active.value).toBe(false)
  })
})
