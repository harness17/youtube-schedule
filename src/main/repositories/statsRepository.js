const DAY_MS = 24 * 60 * 60 * 1000

function rowToVideo(row) {
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
    favoriteOrder: row.favorite_order ?? null,
    source: row.source ?? 'api',
    duration: row.duration ?? null,
    publishedAt: row.published_at ?? null,
    isMembershipOnly: row.is_membership_only === 1,
    isFavorite: row.is_favorite === 1,
    isNotify: row.notify === 1
  }
}

function rowToSilentChannel(row, now) {
  const lastActivityAt = row.last_activity_at ?? null
  return {
    id: row.id,
    title: row.title ?? row.id,
    uploadsPlaylistId: row.uploads_playlist_id ?? null,
    isPinned: row.is_pinned === 1,
    isManual: row.is_manual === 1,
    category: row.is_pinned === 1 ? 'pinned' : row.is_manual === 1 ? 'manual' : 'other',
    lastActivityAt,
    silentDays: lastActivityAt == null ? null : Math.floor((now - lastActivityAt) / DAY_MS)
  }
}

function rowToRanking(row) {
  return {
    channelId: row.channel_id,
    channelTitle: row.channel_title,
    count: row.video_count,
    isPinned: row.is_pinned === 1,
    lastActivityAt: row.last_activity_at ?? null,
    channelUrl: `https://www.youtube.com/channel/${row.channel_id}`
  }
}

export function createStatsRepository(db) {
  const unwatchedPinnedStmt = db.prepare(`
    SELECT v.* FROM videos v
    JOIN channels c ON c.id = v.channel_id
    WHERE c.deleted_at IS NULL
      AND c.is_pinned = 1
      AND v.viewed_at IS NULL
      AND MAX(COALESCE(v.actual_start_time, 0), COALESCE(v.published_at, 0)) >= @since
    ORDER BY MAX(COALESCE(v.actual_start_time, 0), COALESCE(v.published_at, 0)) DESC,
             v.id ASC
  `)

  const silentChannelsStmt = db.prepare(`
    SELECT
      c.id,
      c.title,
      c.uploads_playlist_id,
      c.is_pinned,
      c.is_manual,
      MAX(MAX(COALESCE(v.actual_start_time, 0), COALESCE(v.published_at, 0))) AS last_activity_at
    FROM channels c
    LEFT JOIN videos v ON v.channel_id = c.id
    WHERE c.deleted_at IS NULL
    GROUP BY c.id
    HAVING last_activity_at IS NULL OR last_activity_at = 0 OR last_activity_at <= @threshold
    ORDER BY
      CASE WHEN c.is_pinned = 1 THEN 0 WHEN c.is_manual = 1 THEN 1 ELSE 2 END,
      last_activity_at IS NULL DESC,
      last_activity_at ASC,
      c.title COLLATE NOCASE ASC
  `)

  const frequencyRankingStmt = db.prepare(`
    SELECT
      v.channel_id,
      COALESCE(c.title, v.channel_title) AS channel_title,
      COALESCE(c.is_pinned, 0) AS is_pinned,
      COUNT(*) AS video_count,
      MAX(MAX(COALESCE(v.actual_start_time, 0), COALESCE(v.published_at, 0))) AS last_activity_at
    FROM videos v
    LEFT JOIN channels c ON c.id = v.channel_id
    WHERE (c.deleted_at IS NULL OR c.id IS NULL)
      AND v.channel_id IS NOT NULL
      AND v.channel_id != ''
      AND MAX(COALESCE(v.actual_start_time, 0), COALESCE(v.published_at, 0)) >= @since
    GROUP BY v.channel_id
    ORDER BY video_count DESC, last_activity_at DESC, channel_title COLLATE NOCASE ASC
    LIMIT 20
  `)

  return {
    getChannelActivity(now = Date.now()) {
      const unwatchedPinned = unwatchedPinnedStmt.all({ since: now - 30 * DAY_MS }).map(rowToVideo)
      const silentChannels = silentChannelsStmt
        .all({ threshold: now - 60 * DAY_MS })
        .map((row) => rowToSilentChannel(row, now))
      const frequencyRanking = frequencyRankingStmt
        .all({ since: now - 90 * DAY_MS })
        .map(rowToRanking)

      return { unwatchedPinned, silentChannels, frequencyRanking }
    }
  }
}
