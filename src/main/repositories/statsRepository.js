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

function rowToViewedRate(row) {
  const totalCount = row.total_count
  const viewedCount = row.viewed_count
  return {
    channelId: row.channel_id,
    channelTitle: row.channel_title ?? row.channel_id,
    totalCount,
    viewedCount,
    unviewedCount: totalCount - viewedCount,
    viewedRate: Math.round((viewedCount / totalCount) * 100),
    lastActivityAt: row.last_activity_at ?? null,
    channelUrl: `https://www.youtube.com/channel/${row.channel_id}`
  }
}

function rowToUnviewedBacklog(row) {
  return {
    channelId: row.channel_id,
    channelTitle: row.channel_title ?? row.channel_id,
    unviewedCount: row.unviewed_count,
    notifyCount: row.notify_count,
    oldestActivityAt: row.oldest_activity_at ?? null,
    isPinned: row.is_pinned === 1,
    channelUrl: `https://www.youtube.com/channel/${row.channel_id}`
  }
}

function rowToFavoriteChannel(row) {
  return {
    channelId: row.channel_id,
    channelTitle: row.channel_title ?? row.channel_id,
    favoriteCount: row.favorite_count,
    viewedCount: row.viewed_count,
    isPinned: row.is_pinned === 1,
    channelUrl: `https://www.youtube.com/channel/${row.channel_id}`
  }
}

export function createStatsRepository(db) {
  // 配信（ライブ・プレミア）のみを対象にする。通常の動画投稿は actual_start_time も
  // scheduled_start_time も持たないため、いずれかが NULL でない行が livestreaming 由来。
  const IS_LIVESTREAM = '(v.actual_start_time IS NOT NULL OR v.scheduled_start_time IS NOT NULL)'
  // 配信の活動時刻は actual_start_time を優先、未開始なら scheduled_start_time を使う。
  const LIVE_ACTIVITY_AT = 'COALESCE(v.actual_start_time, v.scheduled_start_time, 0)'

  const unwatchedPinnedStmt = db.prepare(`
    SELECT v.* FROM videos v
    JOIN channels c ON c.id = v.channel_id
    WHERE c.deleted_at IS NULL
      AND c.is_pinned = 1
      AND v.viewed_at IS NULL
      AND ${IS_LIVESTREAM}
      AND ${LIVE_ACTIVITY_AT} >= @since
    ORDER BY ${LIVE_ACTIVITY_AT} DESC, v.id ASC
  `)

  // 沈黙チャンネル: 何らかの投稿実績（配信または動画投稿）があるチャンネルで、最新の
  // 活動が threshold（60日前）より古いものを対象にする。投稿実績ゼロのチャンネル
  // （subscriptions だけ同期されたが動画レコードがない等）は除外する。
  // 直近60日に投稿（動画含む）があるチャンネルは「生きている」ため対象外。
  const ANY_ACTIVITY_AT = 'COALESCE(v.actual_start_time, v.scheduled_start_time, v.published_at, 0)'
  const silentChannelsStmt = db.prepare(`
    SELECT
      c.id,
      c.title,
      c.uploads_playlist_id,
      c.is_pinned,
      c.is_manual,
      MAX(${ANY_ACTIVITY_AT}) AS last_activity_at
    FROM channels c
    LEFT JOIN videos v ON v.channel_id = c.id
    WHERE c.deleted_at IS NULL
    GROUP BY c.id
    HAVING last_activity_at > 0 AND last_activity_at <= @threshold
    ORDER BY
      CASE WHEN c.is_pinned = 1 THEN 0 WHEN c.is_manual = 1 THEN 1 ELSE 2 END,
      last_activity_at ASC,
      c.title COLLATE NOCASE ASC
  `)

  const frequencyRankingStmt = db.prepare(`
    SELECT
      v.channel_id,
      COALESCE(c.title, v.channel_title) AS channel_title,
      COALESCE(c.is_pinned, 0) AS is_pinned,
      COUNT(*) AS video_count,
      MAX(${LIVE_ACTIVITY_AT}) AS last_activity_at
    FROM videos v
    LEFT JOIN channels c ON c.id = v.channel_id
    WHERE (c.deleted_at IS NULL OR c.id IS NULL)
      AND v.channel_id IS NOT NULL
      AND v.channel_id != ''
      AND ${IS_LIVESTREAM}
      AND ${LIVE_ACTIVITY_AT} >= @since
    GROUP BY v.channel_id
    ORDER BY video_count DESC, last_activity_at DESC, channel_title COLLATE NOCASE ASC
    LIMIT 20
  `)

  const viewedRateStmt = db.prepare(`
    SELECT
      v.channel_id,
      COALESCE(c.title, v.channel_title) AS channel_title,
      COUNT(*) AS total_count,
      SUM(CASE WHEN v.viewed_at IS NOT NULL THEN 1 ELSE 0 END) AS viewed_count,
      MAX(${LIVE_ACTIVITY_AT}) AS last_activity_at
    FROM videos v
    JOIN channels c ON c.id = v.channel_id
    WHERE c.deleted_at IS NULL
      AND c.is_pinned = 1
      AND v.status = 'ended'
      AND ${IS_LIVESTREAM}
      AND ${LIVE_ACTIVITY_AT} >= @since
      AND ${LIVE_ACTIVITY_AT} <= @now
    GROUP BY v.channel_id
    ORDER BY
      CAST(SUM(CASE WHEN v.viewed_at IS NOT NULL THEN 1 ELSE 0 END) AS REAL) / COUNT(*) ASC,
      total_count DESC,
      channel_title COLLATE NOCASE ASC
  `)

  const unviewedBacklogStmt = db.prepare(`
    SELECT
      v.channel_id,
      COALESCE(c.title, v.channel_title) AS channel_title,
      c.is_pinned,
      COUNT(*) AS unviewed_count,
      SUM(CASE WHEN v.notify = 1 THEN 1 ELSE 0 END) AS notify_count,
      MIN(${LIVE_ACTIVITY_AT}) AS oldest_activity_at
    FROM videos v
    JOIN channels c ON c.id = v.channel_id
    WHERE c.deleted_at IS NULL
      AND v.status = 'ended'
      AND v.viewed_at IS NULL
      AND ${IS_LIVESTREAM}
      AND ${LIVE_ACTIVITY_AT} >= @since
      AND ${LIVE_ACTIVITY_AT} <= @now
    GROUP BY v.channel_id
    ORDER BY
      unviewed_count DESC,
      oldest_activity_at ASC,
      channel_title COLLATE NOCASE ASC
  `)

  // お気に入りは永久保持され、既存のお気に入りタブもチャンネル削除後に動画を残す。
  // その契約に合わせ、期間や channels.deleted_at では絞らず保存中の全件を集計する。
  const favoriteChannelsStmt = db.prepare(`
    SELECT
      v.channel_id,
      COALESCE(c.title, v.channel_title) AS channel_title,
      COALESCE(c.is_pinned, 0) AS is_pinned,
      COUNT(*) AS favorite_count,
      SUM(CASE WHEN v.viewed_at IS NOT NULL THEN 1 ELSE 0 END) AS viewed_count
    FROM videos v
    LEFT JOIN channels c ON c.id = v.channel_id
    WHERE v.is_favorite = 1
      AND v.channel_id IS NOT NULL
      AND v.channel_id != ''
    GROUP BY v.channel_id
    ORDER BY
      favorite_count DESC,
      viewed_count DESC,
      channel_title COLLATE NOCASE ASC
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
      const viewedRates = viewedRateStmt.all({ since: now - 30 * DAY_MS, now }).map(rowToViewedRate)
      const unviewedBacklog = unviewedBacklogStmt
        .all({ since: now - 30 * DAY_MS, now })
        .map(rowToUnviewedBacklog)
      const favoriteChannels = favoriteChannelsStmt.all().map(rowToFavoriteChannel)

      return {
        unwatchedPinned,
        silentChannels,
        frequencyRanking,
        viewedRates,
        unviewedBacklog,
        favoriteChannels
      }
    }
  }
}
