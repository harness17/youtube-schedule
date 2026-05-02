export const DEFAULT_REMINDER_MINUTES = 5
export const MIN_REMINDER_MINUTES = 1
export const MAX_REMINDER_MINUTES = 1440
export const REMINDER_SETTING_KEY = 'notificationReminderMinutes'

export function normalizeReminderMinutes(value) {
  const minutes = Number(value)
  if (!Number.isFinite(minutes)) return DEFAULT_REMINDER_MINUTES
  return Math.min(MAX_REMINDER_MINUTES, Math.max(MIN_REMINDER_MINUTES, Math.trunc(minutes)))
}
