import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron-store', () => {
  const storage = new Map()
  return {
    default: class {
      get(key, defaultValue) {
        return storage.has(key) ? storage.get(key) : defaultValue
      }
      set(key, value) {
        storage.set(key, value)
      }
      delete(key) {
        storage.delete(key)
      }
    }
  }
})

describe('store (settings-only)', () => {
  let storeModule
  beforeEach(async () => {
    vi.resetModules()
    storeModule = await import('../../src/main/store')
  })

  it('getSetting returns default when key is missing', () => {
    expect(storeModule.getSetting('missing', 'fallback')).toBe('fallback')
  })

  it('setSetting + getSetting round-trip', () => {
    storeModule.setSetting('theme', 'dark')
    expect(storeModule.getSetting('theme', 'light')).toBe('dark')
  })

  it('readLegacyScheduleCache returns null when not set', () => {
    expect(storeModule.readLegacyScheduleCache()).toBeNull()
  })

  it('clearLegacyScheduleCache removes the key', () => {
    storeModule.clearLegacyScheduleCache()
    expect(storeModule.readLegacyScheduleCache()).toBeNull()
  })
})
