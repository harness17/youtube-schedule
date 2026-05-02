import { describe, it, expect } from 'vitest'
import {
  DEFAULT_REMINDER_MINUTES,
  MAX_REMINDER_MINUTES,
  MIN_REMINDER_MINUTES,
  normalizeReminderMinutes
} from '../../src/renderer/constants/notificationSettings.js'

describe('notificationSettings', () => {
  it('不正な通知分数はデフォルトの5分に戻す', () => {
    expect(normalizeReminderMinutes('not-number')).toBe(DEFAULT_REMINDER_MINUTES)
  })

  it('通知分数は1分から1440分に丸める', () => {
    expect(normalizeReminderMinutes(0)).toBe(MIN_REMINDER_MINUTES)
    expect(normalizeReminderMinutes(2000)).toBe(MAX_REMINDER_MINUTES)
  })

  it('小数の通知分数は整数に丸める', () => {
    expect(normalizeReminderMinutes(12.8)).toBe(12)
  })
})
