const UPCOMING_GRACE_MS = 2 * 60 * 60 * 1000
const LIVE_MAX_DURATION_MS = 24 * 60 * 60 * 1000

export function deriveStatus(v, now) {
  const ld = v.liveStreamingDetails
  const bc = v.snippet?.liveBroadcastContent

  if (ld?.actualEndTime) return 'ended'
  if (ld?.actualStartTime) {
    const elapsed = now - new Date(ld.actualStartTime).getTime()
    return elapsed < LIVE_MAX_DURATION_MS ? 'live' : 'ended'
  }
  if (bc === 'upcoming') {
    const startMs = ld?.scheduledStartTime ? new Date(ld.scheduledStartTime).getTime() : now + 1
    return startMs > now - UPCOMING_GRACE_MS ? 'upcoming' : 'ended'
  }
  return 'ended'
}
