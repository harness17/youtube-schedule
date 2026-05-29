import { createVideoQueries } from './videoQueries.js'

export function createVideoRepository(db) {
  const queries = createVideoQueries(db)
  const upsertStmt = db.prepare(`
    INSERT INTO videos (
      id, channel_id, channel_title, title, description, thumbnail,
      status, scheduled_start_time, actual_start_time, concurrent_viewers,
      url, first_seen_at, last_checked_at, ended_at, duration, published_at,
      is_membership_only, source
    ) VALUES (
      @id, @channelId, @channelTitle, @title, @description, @thumbnail,
      @status, @scheduledStartTime, @actualStartTime, @concurrentViewers,
      @url, @firstSeenAt, @lastCheckedAt,
      CASE WHEN @status = 'ended' THEN @lastCheckedAt ELSE NULL END,
      @duration, @publishedAt, @isMembershipOnly, @source
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
      duration = COALESCE(excluded.duration, videos.duration),
      published_at = COALESCE(excluded.published_at, videos.published_at),
      is_membership_only = MAX(excluded.is_membership_only, videos.is_membership_only),
      source = excluded.source,
      ended_at = CASE
        WHEN excluded.status = 'ended' AND videos.ended_at IS NULL THEN excluded.last_checked_at
        WHEN excluded.status != 'ended' THEN NULL
        ELSE videos.ended_at
      END
  `)

  const getByIdStmt = db.prepare(`SELECT * FROM videos WHERE id = ?`)
  const markViewedStmt = db.prepare(`UPDATE videos SET viewed_at = @now WHERE id = @id`)
  const clearViewedStmt = db.prepare(`UPDATE videos SET viewed_at = NULL WHERE id = @id`)
  const toggleFavStmt = db.prepare(`
    UPDATE videos
    SET is_favorite = CASE is_favorite WHEN 1 THEN 0 ELSE 1 END,
        favorite_order = CASE
          WHEN is_favorite = 1 THEN NULL
          WHEN EXISTS (SELECT 1 FROM videos WHERE is_favorite = 1 AND favorite_order IS NOT NULL)
            THEN COALESCE(
              favorite_order,
              (SELECT COALESCE(MAX(favorite_order), -1) + 1 FROM videos WHERE is_favorite = 1)
            )
          ELSE favorite_order
        END
    WHERE id = @id
  `)
  const setFavStmt = db.prepare(`
    UPDATE videos
    SET is_favorite = 1,
        viewed_at = COALESCE(@viewedAt, viewed_at),
        favorite_order = CASE
          WHEN EXISTS (SELECT 1 FROM videos WHERE is_favorite = 1 AND favorite_order IS NOT NULL)
            THEN COALESCE(
              favorite_order,
              (SELECT COALESCE(MAX(favorite_order), -1) + 1 FROM videos WHERE is_favorite = 1)
            )
          ELSE favorite_order
        END
    WHERE id = @id
  `)
  const getByIdForFavStmt = db.prepare(`SELECT id FROM videos WHERE id = @id`)
  const importAsFavInsertStmt = db.prepare(`
    INSERT OR IGNORE INTO videos (
      id, channel_id, channel_title, title, description, thumbnail,
      status, url, first_seen_at, last_checked_at
    ) VALUES (
      @id, @channelId, @channelTitle, @title, '', '',
      'ended', @url, @now, @now
    )
  `)
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
  const clearFavoriteOrderStmt = db.prepare(`
    UPDATE videos SET favorite_order = NULL WHERE is_favorite = 1
  `)
  const updateFavoriteOrderStmt = db.prepare(`
    UPDATE videos SET favorite_order = @orderIndex WHERE id = @id AND is_favorite = 1
  `)
  const backfillMetaStmt = db.prepare(`
    UPDATE videos
    SET duration = COALESCE(@duration, duration),
        published_at = COALESCE(@publishedAt, published_at)
    WHERE id = @id
  `)
  const saveFavoriteOrderTx = db.transaction((ids) => {
    clearFavoriteOrderStmt.run()
    let orderIndex = 0
    for (const id of ids) {
      const result = updateFavoriteOrderStmt.run({ id, orderIndex })
      if (result.changes > 0) orderIndex += 1
    }
  })

  return {
    ...queries,
    upsert(video) {
      upsertStmt.run({
        ...video,
        duration: video.duration ?? null,
        publishedAt: video.publishedAt ?? null,
        isMembershipOnly: video.isMembershipOnly ? 1 : 0,
        source: video.source ?? 'api'
      })
    },
    // duration / published_at のみを更新する。null は既存値を保持（COALESCE）
    backfillMeta(id, { duration = null, publishedAt = null } = {}) {
      backfillMetaStmt.run({ id, duration, publishedAt })
    },
    saveFavoriteOrder(ids) {
      if (!Array.isArray(ids)) return false
      const uniqueIds = [...new Set(ids.filter((id) => typeof id === 'string' && id.trim()))]
      saveFavoriteOrderTx(uniqueIds)
      return true
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
    setFavorite(id, viewedAt = null) {
      const exists = getByIdForFavStmt.get({ id })
      if (!exists) return null
      setFavStmt.run({ id, viewedAt })
      return true
    },
    importAsFavorite({ id, title, channelId, channelTitle, viewedAt }, now = Date.now()) {
      const url = `https://www.youtube.com/watch?v=${id}`
      importAsFavInsertStmt.run({
        id,
        channelId: channelId ?? '',
        channelTitle: channelTitle ?? '',
        title: title ?? '',
        url,
        now
      })
      setFavStmt.run({ id, viewedAt: viewedAt ?? null })
      return true
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
