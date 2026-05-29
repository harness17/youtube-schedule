export const RECHECK_STALE_MS = 24 * 60 * 60 * 1000

export function planRefreshTargets({ videoIds, known, manualIds, forceFullRecheck, now }) {
  const knownIds = new Set(known.map((v) => v.id))
  const recheckIds = forceFullRecheck
    ? Array.from(knownIds)
    : known
        .filter(
          (v) =>
            v.status === 'live' ||
            v.status === 'upcoming' ||
            (v.status !== 'ended' && now - v.lastCheckedAt > RECHECK_STALE_MS)
        )
        .map((v) => v.id)
  const newIds = videoIds.filter((id) => !knownIds.has(id))
  const target = Array.from(new Set([...newIds, ...recheckIds, ...manualIds]))

  return { target, newIds, recheckIds }
}
