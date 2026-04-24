const UPCOMING_GRACE_MS = 2 * 60 * 60 * 1000
const LIVE_MAX_DURATION_MS = 24 * 60 * 60 * 1000

export function createVideoRepository(db) {
  const upsertStmt = db.prepare(`
    INSERT INTO videos (
      id, channel_id, channel_title, title, description, thumbnail,
      status, scheduled_start_time, actual_start_time, concurrent_viewers,
      url, first_seen_at, last_checked_at, ended_at
    ) VALUES (
      @id, @channelId, @channelTitle, @title, @description, @thumbnail,
      @status, @scheduledStartTime, @actualStartTime, @concurrentViewers,
      @url, @firstSeenAt, @lastCheckedAt,
      CASE WHEN @status = 'ended' THEN @lastCheckedAt ELSE NULL END
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
      last_checked_at = excluded.last_checked_at,
      ended_at = CASE
        WHEN excluded.status = 'ended' AND videos.ended_at IS NULL THEN excluded.last_checked_at
        WHEN excluded.status != 'ended' THEN NULL
        ELSE videos.ended_at
      END
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
  const listMissedStmt = db.prepare(`
    SELECT v.* FROM videos v
    LEFT JOIN channels c ON v.channel_id = c.id
    WHERE v.status = 'ended'
      AND v.notify = 1
      AND v.viewed_at IS NULL
      AND (
        (v.actual_start_time IS NOT NULL AND v.actual_start_time < @now) OR
        (v.actual_start_time IS NULL AND v.scheduled_start_time IS NOT NULL AND v.scheduled_start_time < @now)
      )
    ORDER BY
      CASE WHEN c.is_pinned = 1 THEN 0 ELSE 1 END,
      COALESCE(v.actual_start_time, v.scheduled_start_time) DESC
  `)
  const listArchiveStmt = db.prepare(`
    SELECT * FROM videos
    WHERE status = 'ended'
    ORDER BY COALESCE(ended_at, last_checked_at) DESC
    LIMIT @limit OFFSET @offset
  `)
  const listFavoritesStmt = db.prepare(`
    SELECT v.* FROM videos v
    LEFT JOIN channels c ON v.channel_id = c.id
    WHERE v.is_favorite = 1
    ORDER BY
      CASE WHEN c.is_pinned = 1 THEN 0 ELSE 1 END,
      COALESCE(v.scheduled_start_time, v.last_checked_at) DESC
  `)
  const searchStmt = db.prepare(`
    SELECT * FROM videos
    WHERE status = 'ended'
      AND (
        (@searchTitle   AND title        LIKE '%' || @query || '%' ESCAPE '!')
        OR (@searchChannel AND channel_title LIKE '%' || @query || '%' ESCAPE '!')
        OR (@searchDesc    AND description  LIKE '%' || @query || '%' ESCAPE '!')
      )
    ORDER BY COALESCE(actual_start_time, scheduled_start_time, last_checked_at) DESC
    LIMIT @limit
  `)
  const markViewedStmt = db.prepare(`UPDATE videos SET viewed_at = @now WHERE id = @id`)
  const clearViewedStmt = db.prepare(`UPDATE videos SET viewed_at = NULL WHERE id = @id`)
  const toggleFavStmt = db.prepare(
    `UPDATE videos SET is_favorite = CASE is_favorite WHEN 1 THEN 0 ELSE 1 END WHERE id = @id`
  )
  const toggleNotifyStmt = db.prepare(
    `UPDATE videos SET notify = CASE notify WHEN 1 THEN 0 ELSE 1 END WHERE id = @id`
  )
  const markEndedStmt = db.prepare(`
    UPDATE videos
    SET status = 'ended',
        ended_at = CASE WHEN ended_at IS NULL THEN @now ELSE ended_at END,
        last_checked_at = @now
    WHERE id = @id AND status != 'ended'
  `)
  const deleteExpiredStmt = db.prepare(`
    DELETE FROM videos
    WHERE status = 'ended'
      AND is_favorite = 0
      AND (
        (notify = 1 AND viewed_at IS NULL AND COALESCE(ended_at, last_checked_at) < @notifyThreshold)
        OR
        ((notify = 0 OR viewed_at IS NOT NULL) AND COALESCE(ended_at, last_checked_at) < @defaultThreshold)
      )
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
      lastCheckedAt: row.last_checked_at,
      endedAt: row.ended_at ?? null,
      viewedAt: row.viewed_at ?? null,
      isFavorite: row.is_favorite === 1,
      isNotify: row.notify === 1
    }
  }

  function escapeLikeQuery(raw) {
    const trimmed = String(raw ?? '').trim()
    if (!trimmed) return ''
    // LIKE のワイルドカード文字（! % _）をエスケープ
    return trimmed.replace(/[!%_]/g, '!$&')
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
    listMissed(now = Date.now()) {
      return listMissedStmt.all({ now }).map(rowToVideo)
    },
    listArchive({ limit = 50, offset = 0 } = {}) {
      return listArchiveStmt.all({ limit, offset }).map(rowToVideo)
    },
    listFavorites() {
      return listFavoritesStmt.all().map(rowToVideo)
    },
    searchByText(query, { limit = 50, title = true, channel = true, description = false } = {}) {
      const likeQuery = escapeLikeQuery(query)
      if (!likeQuery) return []
      return searchStmt
        .all({
          query: likeQuery,
          limit,
          searchTitle: title ? 1 : 0,
          searchChannel: channel ? 1 : 0,
          searchDesc: description ? 1 : 0
        })
        .map(rowToVideo)
    },
    markViewed(id, now = Date.now()) {
      const r = markViewedStmt.run({ id, now })
      return r.changes > 0
    },
    clearViewed(id) {
      const r = clearViewedStmt.run({ id })
      return r.changes > 0
    },
    toggleFavorite(id) {
      const r = toggleFavStmt.run({ id })
      if (r.changes === 0) return null
      return getByIdStmt.get(id)?.is_favorite === 1
    },
    toggleNotify(id) {
      const r = toggleNotifyStmt.run({ id })
      if (r.changes === 0) return null
      return getByIdStmt.get(id)?.notify === 1
    },
    markEnded(id, now = Date.now()) {
      const r = markEndedStmt.run({ id, now })
      return r.changes > 0
    },
    deleteExpiredEnded({ defaultThreshold, notifyThreshold }) {
      const result = deleteExpiredStmt.run({ defaultThreshold, notifyThreshold })
      return result.changes
    }
  }
}
