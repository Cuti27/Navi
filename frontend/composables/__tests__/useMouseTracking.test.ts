import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useMouseTracking } from '../useMouseTracking'

describe('useMouseTracking', () => {
  it('trackingStyle starts at origin', () => {
    const svgRef = ref(null)
    const { trackingStyle } = useMouseTracking(svgRef)
    expect(trackingStyle.value.transform).toBe('translate(0px, 0px)')
  })
})
