import { useEffect, useRef } from 'react'
import {
  DEFAULT_REMINDER_MINUTES,
  normalizeReminderMinutes
} from '../constants/notificationSettings.js'

// 配信開始5分前とライブ開始時にデスクトップ通知を出す。
// upcomingRef / notifiedRef の ref ペアは stale closure 対策。
// interval コールバックは初回マウント時のクロージャを保持するため、
// 最新の upcoming は ref 経由で参照する。
export function useNotificationCheck({
  upcoming,
  live = [],
  isAuthenticated,
  reminderMinutes = DEFAULT_REMINDER_MINUTES
}) {
  const upcomingRef = useRef(upcoming)
  useEffect(() => {
    upcomingRef.current = upcoming
  }, [upcoming])
  const reminderMinutesRef = useRef(normalizeReminderMinutes(reminderMinutes))
  useEffect(() => {
    reminderMinutesRef.current = normalizeReminderMinutes(reminderMinutes)
  }, [reminderMinutes])

  const notifiedRef = useRef(new Set())
  const knownLiveIdsRef = useRef(new Set())
  const liveNotifiedRef = useRef(new Set())
  const liveBaselineSyncedRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated) {
      knownLiveIdsRef.current = new Set()
      liveBaselineSyncedRef.current = false
      return
    }

    const currentLiveIds = new Set(live.map((item) => item.id))
    if (!liveBaselineSyncedRef.current) {
      knownLiveIdsRef.current = currentLiveIds
      liveBaselineSyncedRef.current = true
      return
    }

    for (const item of live) {
      if (!item.isNotify) continue
      if (knownLiveIdsRef.current.has(item.id)) continue
      if (liveNotifiedRef.current.has(item.id)) continue
      liveNotifiedRef.current.add(item.id)
      window.api?.showNotification?.(
        '配信が始まりました',
        `${item.channelTitle}「${item.title}」がライブ配信を開始しました`
      )
    }

    knownLiveIdsRef.current = currentLiveIds
  }, [live, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) return
    const id = setInterval(() => {
      const now = Date.now()
      const threshold = reminderMinutesRef.current * 60 * 1000
      for (const item of upcomingRef.current) {
        if (!item.isNotify) continue
        if (notifiedRef.current.has(item.id)) continue
        const start = new Date(item.scheduledStartTime).getTime()
        const remaining = start - now
        if (remaining > 0 && remaining <= threshold) {
          notifiedRef.current.add(item.id)
          window.api?.showNotification?.(
            'もうすぐ配信開始',
            `${item.channelTitle}「${item.title}」が${reminderMinutesRef.current}分後に始まります`
          )
        }
      }
    }, 60 * 1000)
    return () => clearInterval(id)
  }, [isAuthenticated])
}
