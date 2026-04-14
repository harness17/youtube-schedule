import { useState, useEffect } from 'react'

export function useSchedule() {
  const [live, setLive] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fromCache, setFromCache] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.getSchedule()
      if (result.error) {
        setError(result.error)
      } else if (result.data) {
        setLive(result.data.live ?? [])
        setUpcoming(result.data.upcoming ?? [])
        setFromCache(result.fromCache)
      }
    } catch (e) {
      setError(e.message ?? 'FETCH_FAILED')
    } finally {
      setLoading(false)
    }
  }

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const result = await window.api.refreshSchedule()
      if (result.error) {
        setError(result.error)
      } else if (result.data) {
        setLive(result.data.live ?? [])
        setUpcoming(result.data.upcoming ?? [])
        setFromCache(false)
      }
    } catch (e) {
      setError(e.message ?? 'FETCH_FAILED')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function applyResult(data) {
    setLive(data.live ?? [])
    setUpcoming(data.upcoming ?? [])
    setFromCache(false)
  }

  return { live, upcoming, loading, error, fromCache, refresh, applyResult }
}
