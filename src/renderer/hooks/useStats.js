import { useCallback, useEffect, useState } from 'react'

const EMPTY_STATS = {
  unwatchedPinned: [],
  silentChannels: [],
  frequencyRanking: []
}

export function useStats(active) {
  const [stats, setStats] = useState(EMPTY_STATS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api.getChannelActivityStats?.()
      if (data?.error) {
        setError(data.error)
        setStats(EMPTY_STATS)
      } else {
        setStats({
          unwatchedPinned: data?.unwatchedPinned ?? [],
          silentChannels: data?.silentChannels ?? [],
          frequencyRanking: data?.frequencyRanking ?? []
        })
      }
    } catch {
      setError('LOAD_FAILED')
      setStats(EMPTY_STATS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (active) loadStats()
  }, [active, loadStats])

  useEffect(() => {
    if (!active) return undefined
    return window.api.onScheduleUpdated?.(() => {
      loadStats()
    })
  }, [active, loadStats])

  return { stats, loading, error, reload: loadStats }
}
