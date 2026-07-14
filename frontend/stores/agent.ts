export type AgentState =
  | 'idle'
  | 'thinking'
  | 'tool-calling'
  | 'awaiting-approval'
  | 'error'
  | 'compacting'

export const useAgentStore = defineStore('agent', () => {
  const state = ref<AgentState>('idle')

  function setState(value: AgentState) {
    state.value = value
  }

  return { state, setState }
})
