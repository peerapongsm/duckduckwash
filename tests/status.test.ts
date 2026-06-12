import { describe, it, expect } from 'vitest'
import { nextStatus } from '../src/main/logic/status'

describe('nextStatus', () => {
  it('follows waiting_input → in_progress → complete → closed', () => {
    expect(nextStatus('waiting_input')).toBe('in_progress')
    expect(nextStatus('in_progress')).toBe('complete')
    expect(nextStatus('complete')).toBe('closed')
  })

  it('closed is terminal', () => {
    expect(nextStatus('closed')).toBeNull()
  })
})
