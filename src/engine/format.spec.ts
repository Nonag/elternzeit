import { describe, expect, it } from 'vitest'
import { formatRecentTimestamp } from './format'

describe('formatRecentTimestamp', () => {
  it('leaves out the date for a time today', () => {
    const saved = new Date(2026, 10, 12, 11, 36).toISOString()
    expect(formatRecentTimestamp(saved, new Date(2026, 10, 12, 15, 0))).toBe('um 11:36')
    expect(formatRecentTimestamp(saved, new Date(2026, 10, 13, 9, 0))).toBe('am 12.11.2026 um 11:36')
  })
})
