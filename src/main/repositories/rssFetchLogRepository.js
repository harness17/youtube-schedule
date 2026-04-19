export function createRssFetchLogRepository(db) {
  const insert = db.prepare(`
    INSERT INTO rss_fetch_log (channel_id, fetched_at, success, http_status, error_message)
    VALUES (@channelId, @fetchedAt, @success, @httpStatus, @errorMessage)
  `)
  const rateStmt = db.prepare(`
    SELECT
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures,
      COUNT(*) AS total
    FROM rss_fetch_log
    WHERE fetched_at >= ?
  `)
  const pruneStmt = db.prepare(`DELETE FROM rss_fetch_log WHERE fetched_at < ?`)

  return {
    record({ channelId, fetchedAt, success, httpStatus = null, errorMessage = null }) {
      insert.run({
        channelId,
        fetchedAt,
        success: success ? 1 : 0,
        httpStatus,
        errorMessage
      })
    },
    getFailureRateSince(sinceMs) {
      const row = rateStmt.get(sinceMs)
      if (!row || row.total === 0) return 0
      return row.failures / row.total
    },
    pruneOlderThan(thresholdMs) {
      return pruneStmt.run(thresholdMs).changes
    }
  }
}
