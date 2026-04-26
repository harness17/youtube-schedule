import { useEffect, useRef } from 'react'

// 配信開始5分前にデスクトップ通知を出す。
// upcomingRef / notifiedRef の ref ペアは stale closure 対策。
// interval コールバックは初回マウント時のクロージャを保持するため、
// 最新の upcoming は ref 経由で参照する。
export function useNotificationCheck({ upcoming, isAuthenticated }) {
  const upcomingRef = useRef(upcoming)
  useEffect(() => {
    upcomingRef.current = upcoming
  }, [upcoming])

  const notifiedRef = useRef(new Set())

  useEffect(() => {
    if (!isAuthenticated) return
    const THRESHOLD = 5 * 60 * 1000
    const id = setInterval(() => {
      const now = Date.now()
      for (const item of upcomingRef.current) {
        if (!item.isNotify) continue
        if (notifiedRef.current.has(item.id)) continue
        const start = new Date(item.scheduledStartTime).getTime()
        const remaining = start - now
        if (remaining > 0 && remaining <= THRESHOLD) {
          notifiedRef.current.add(item.id)
          window.api?.showNotification?.(
            'もうすぐ配信開始',
            `${item.channelTitle}「${item.title}」が5分後に始まります`
          )
        }
      }
    }, 60 * 1000)
    return () => clearInterval(id)
  }, [isAuthenticated])
}
