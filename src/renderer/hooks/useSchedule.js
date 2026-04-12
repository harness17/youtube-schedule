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
    const result = await window.api.getSchedule()
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setLive(result.data.live)
      setUpcoming(result.data.upcoming)
      setFromCache(result.fromCache)
    }
  }

  async function refresh() {
    setLoading(true)
    setError(null)
    const result = await window.api.refreshSchedule()
    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setLive(result.data.live)
      setUpcoming(result.data.upcoming)
      setFromCache(false)
    }
  }

  useEffect(() => { load() }, [])

  return { live, upcoming, loading, error, fromCache, refresh }
}
