const UPCOMING_GRACE_MS = 2 * 60 * 60 * 1000
const LIVE_MAX_DURATION_MS = 24 * 60 * 60 * 1000

export function createVideoRepository(db) {
  const upsertStmt = db.prepare(`
    INSERT INTO videos (
      id, channel_id, channel_title, title, description, thumbnail,
      status, scheduled_start_time, actual_start_time, concurrent_viewers,
      url, first_seen_at, last_checked_at
    ) VALUES (
      @id, @channelId, @channelTitle, @title, @description, @thumbnail,
      @status, @scheduledStartTime, @actualStartTime, @concurrentViewers,
      @url, @firstSeenAt, @lastCheckedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      channel_id = excluded.channel_id,
      channel_title = excluded.channel_title,
      title = excluded.title,
      description = excluded.description,
      thumbnail = excluded.thumbnail,
      status = excluded.status,
      scheduled_start_time = excluded.scheduled_start_time,
      actual_start_time = excluded.actual_start_time,
      concurrent_viewers = excluded.concurrent_viewers,
      url = excluded.url,
      last_checked_at = excluded.last_checked_at
  `)

  const getByIdStmt = db.prepare(`SELECT * FROM videos WHERE id = ?`)
  const countStmt = db.prepare(`SELECT COUNT(*) AS c FROM videos`)
  const listVisibleStmt = db.prepare(`
    SELECT * FROM videos
    WHERE (status = 'live' AND actual_start_time > @liveThreshold)
       OR (status = 'upcoming' AND scheduled_start_time > @upcomingThreshold)
    ORDER BY
      CASE status WHEN 'live' THEN 0 ELSE 1 END,
      scheduled_start_time ASC
  `)
  const deleteExpiredStmt = db.prepare(`
    DELETE FROM videos WHERE status = 'ended' AND last_checked_at < ?
  `)

  function rowToVideo(row) {
    if (!row) return null
    return {
      id: row.id,
      channelId: row.channel_id,
      channelTitle: row.channel_title,
      title: row.title,
      description: row.description,
      thumbnail: row.thumbnail,
      status: row.status,
      scheduledStartTime: row.scheduled_start_time,
      actualStartTime: row.actual_start_time,
      concurrentViewers: row.concurrent_viewers,
      url: row.url,
      firstSeenAt: row.first_seen_at,
      lastCheckedAt: row.last_checked_at
    }
  }

  return {
    upsert(video) {
      upsertStmt.run(video)
    },
    getById(id) {
      return rowToVideo(getByIdStmt.get(id))
    },
    getByIds(ids) {
      if (ids.length === 0) return []
      const placeholders = ids.map(() => '?').join(',')
      return db
        .prepare(`SELECT * FROM videos WHERE id IN (${placeholders})`)
        .all(...ids)
        .map(rowToVideo)
    },
    count() {
      return countStmt.get().c
    },
    listVisible(now = Date.now()) {
      return listVisibleStmt
        .all({
          liveThreshold: now - LIVE_MAX_DURATION_MS,
          upcomingThreshold: now - UPCOMING_GRACE_MS
        })
        .map(rowToVideo)
    },
    deleteExpiredEnded(thresholdMs) {
      const result = deleteExpiredStmt.run(thresholdMs)
      return result.changes
    }
  }
}
