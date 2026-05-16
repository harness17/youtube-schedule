import { describe, it, expect } from 'vitest'
import { resolveVideoId } from '../../src/main/lib/resolveVideoId.js'

describe('resolveVideoId', () => {
  it('returns a bare 11-char video id as-is', () => {
    expect(resolveVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts id from a watch URL', () => {
    expect(resolveVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts id from a watch URL with extra params', () => {
    expect(resolveVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe('dQw4w9WgXcQ')
  })

  it('extracts id from a youtu.be short URL', () => {
    expect(resolveVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts id from a /live/ URL', () => {
    expect(resolveVideoId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('trims surrounding whitespace', () => {
    expect(resolveVideoId('  dQw4w9WgXcQ  ')).toBe('dQw4w9WgXcQ')
  })

  it('returns null for empty or non-string input', () => {
    expect(resolveVideoId('')).toBeNull()
    expect(resolveVideoId(null)).toBeNull()
    expect(resolveVideoId(undefined)).toBeNull()
  })

  it('returns null when no valid id can be extracted', () => {
    expect(resolveVideoId('https://www.youtube.com/')).toBeNull()
    expect(resolveVideoId('not a url or id')).toBeNull()
    expect(resolveVideoId('too-short')).toBeNull()
  })
})
