import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAgentStore } from '../agent'

describe('useAgentStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts in idle state', () => {
    const store = useAgentStore()
    expect(store.state).toBe('idle')
  })

  it('setState transitions to any valid state', () => {
    const store = useAgentStore()

    store.setState('thinking')
    expect(store.state).toBe('thinking')

    store.setState('tool-calling')
    expect(store.state).toBe('tool-calling')

    store.setState('awaiting-approval')
    expect(store.state).toBe('awaiting-approval')

    store.setState('error')
    expect(store.state).toBe('error')

    store.setState('compacting')
    expect(store.state).toBe('compacting')

    store.setState('idle')
    expect(store.state).toBe('idle')
  })
})
