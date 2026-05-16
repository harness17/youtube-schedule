import { describe, it, expect } from 'vitest'
import { parseDuration } from '../../src/main/lib/parseDuration.js'

describe('parseDuration', () => {
  it('parses hours, minutes, seconds', () => {
    expect(parseDuration('PT1H2M3S')).toBe(3723)
  })

  it('parses minutes and seconds only', () => {
    expect(parseDuration('PT15M30S')).toBe(930)
  })

  it('parses seconds only', () => {
    expect(parseDuration('PT45S')).toBe(45)
  })

  it('parses hours only', () => {
    expect(parseDuration('PT2H')).toBe(7200)
  })

  it('returns 0 for PT0S', () => {
    expect(parseDuration('PT0S')).toBe(0)
  })

  it('returns null for null / undefined / empty', () => {
    expect(parseDuration(null)).toBeNull()
    expect(parseDuration(undefined)).toBeNull()
    expect(parseDuration('')).toBeNull()
  })

  it('returns null for malformed input', () => {
    expect(parseDuration('garbage')).toBeNull()
    expect(parseDuration('P1D')).toBeNull()
  })
})
