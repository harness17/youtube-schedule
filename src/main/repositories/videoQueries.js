const UPCOMING_GRACE_MS = 2 * 60 * 60 * 1000
const UPCOMING_FUTURE_MS = 31 * 24 * 60 * 60 * 1000
const LIVE_MAX_DURATION_MS = 24 * 60 * 60 * 1000
const RSS_ONLY_VISIBLE_MS = 24 * 60 * 60 * 1000

export function rowToVideo(row) {
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
    favoriteOrder: row.favorite_order ?? null,
    source: row.source ?? 'api',
    duration: row.duration ?? null,
    publishedAt: row.published_at ?? null,
    isMembershipOnly: row.is_membership_only === 1,
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

export function createVideoQueries(db) {
  const getByIdStmt = db.prepare(`SELECT * FROM videos WHERE id = ?`)
  const countStmt = db.prepare(`SELECT COUNT(*) AS c FROM videos`)
  // 論理削除されたチャンネル（channels.deleted_at IS NOT NULL）の動画は
  // アクティブな予定表に出さない。channels に行が無い動画（手動登録・インポート
  // お気に入りなど）は LEFT JOIN で c.deleted_at が NULL になり、従来どおり表示される。
  const listVisibleStmt = db.prepare(`
    SELECT v.* FROM videos v
    LEFT JOIN channels c ON v.channel_id = c.id
    WHERE c.deleted_at IS NULL
      AND (
           (v.status = 'live' AND v.actual_start_time > @liveThreshold)
        OR (v.status = 'upcoming' AND v.scheduled_start_time > @upcomingThreshold AND v.scheduled_start_time < @upcomingUpperThreshold)
        OR (@includeFeedItems AND v.status = 'upcoming' AND v.scheduled_start_time IS NULL AND v.last_checked_at > @rssOnlyThreshold)
      )
    ORDER BY
      CASE v.status WHEN 'live' THEN 0 ELSE 1 END,
      COALESCE(v.scheduled_start_time, v.last_checked_at) ASC
  `)
  const listMissedStmt = db.prepare(`
    SELECT v.* FROM videos v
    LEFT JOIN channels c ON v.channel_id = c.id
    WHERE v.notify = 1
      AND v.viewed_at IS NULL
      AND (
        v.status IN ('upcoming', 'live')
        OR (
          v.status = 'ended'
          AND (
            (v.actual_start_time IS NOT NULL AND v.actual_start_time < @now) OR
            (v.actual_start_time IS NULL AND v.scheduled_start_time IS NOT NULL AND v.scheduled_start_time < @now)
          )
        )
      )
    ORDER BY
      CASE WHEN c.is_pinned = 1 THEN 0 ELSE 1 END,
      CASE v.status WHEN 'live' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END,
      COALESCE(v.actual_start_time, v.scheduled_start_time) DESC
  `)
  const listFavoritesStmt = db.prepare(`
    SELECT v.* FROM videos v
    LEFT JOIN channels c ON v.channel_id = c.id
    WHERE v.is_favorite = 1
    ORDER BY
      CASE WHEN v.favorite_order IS NULL THEN 1 ELSE 0 END,
      v.favorite_order ASC,
      CASE WHEN c.is_pinned = 1 THEN 0 ELSE 1 END,
      COALESCE(v.scheduled_start_time, v.last_checked_at) DESC
  `)
  const listFeedStmt = db.prepare(`
    SELECT * FROM videos
    WHERE status = 'upcoming'
      AND scheduled_start_time IS NULL
    ORDER BY first_seen_at DESC
    LIMIT @limit
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
  const backfillTargetIdsStmt = db.prepare(`
    SELECT id FROM videos
    WHERE status = 'ended' AND (duration IS NULL OR published_at IS NULL)
  `)
  const manualTrackingIdsStmt = db.prepare(`
    SELECT id FROM videos WHERE source = 'manual' AND status != 'ended'
  `)

  return {
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
    listVisible(now = Date.now(), { includeFeedItems = false } = {}) {
      return listVisibleStmt
        .all({
          liveThreshold: now - LIVE_MAX_DURATION_MS,
          upcomingThreshold: now - UPCOMING_GRACE_MS,
          upcomingUpperThreshold: now + UPCOMING_FUTURE_MS,
          rssOnlyThreshold: now - RSS_ONLY_VISIBLE_MS,
          includeFeedItems: includeFeedItems ? 1 : 0
        })
        .map(rowToVideo)
    },
    listMissed(now = Date.now()) {
      return listMissedStmt.all({ now }).map(rowToVideo)
    },
    listArchive({
      limit = 50,
      offset = 0,
      query = '',
      channelId = null,
      channelIds = null,
      periodStart = null,
      periodEnd = null,
      sort = 'newest',
      title = true,
      channel = true,
      description = false
    } = {}) {
      const likeQuery = escapeLikeQuery(query)
      const params = {
        limit,
        offset,
        query: likeQuery,
        searchTitle: title ? 1 : 0,
        searchChannel: channel ? 1 : 0,
        searchDesc: description ? 1 : 0
      }
      const where = [`status = 'ended'`]

      // チャンネル絞り込み: channelIds（複数）を優先、無ければ channelId（単一・後方互換）
      const ids =
        Array.isArray(channelIds) && channelIds.length > 0
          ? channelIds
          : channelId && channelId !== 'all'
            ? [channelId]
            : []
      if (ids.length > 0) {
        const placeholders = ids.map((_, i) => `@ch${i}`).join(', ')
        where.push(`channel_id IN (${placeholders})`)
        ids.forEach((id, i) => {
          params[`ch${i}`] = id
        })
      }

      // アーカイブは「実際に配信されたライブ・プレミア」のみを対象とする。
      // actual_start_time が無いもの＝通常アップロード動画・流れた配信（予約のみ）は除外。
      where.push(`actual_start_time IS NOT NULL`)

      // カードに表示する日付と同じ基準。配信実績 → 投稿日 → 予約 → ended → 最終確認 の順。
      // 期間フィルタとソートの両方でこの式を使い、表示・絞り込み・並びを一致させる。
      const dateExpr =
        'COALESCE(actual_start_time, published_at, scheduled_start_time, ended_at, last_checked_at)'

      // 期間
      if (typeof periodStart === 'number') {
        where.push(`${dateExpr} >= @periodStart`)
        params.periodStart = periodStart
      }
      if (typeof periodEnd === 'number') {
        where.push(`${dateExpr} <= @periodEnd`)
        params.periodEnd = periodEnd
      }

      // テキスト検索
      where.push(`(
        @query = ''
        OR (
          (@searchTitle AND title LIKE '%' || @query || '%' ESCAPE '!')
          OR (@searchChannel AND channel_title LIKE '%' || @query || '%' ESCAPE '!')
          OR (@searchDesc AND description LIKE '%' || @query || '%' ESCAPE '!')
        )
      )`)

      const orderBy =
        {
          newest: `${dateExpr} DESC`,
          oldest: `${dateExpr} ASC`,
          channel: `channel_title COLLATE NOCASE ASC, ${dateExpr} DESC`,
          duration: `duration IS NULL, duration DESC`
        }[sort] ?? `${dateExpr} DESC`

      const sql = `
        SELECT * FROM videos
        WHERE ${where.join(' AND ')}
        ORDER BY ${orderBy}
        LIMIT @limit OFFSET @offset
      `
      return db.prepare(sql).all(params).map(rowToVideo)
    },
    listFavorites() {
      return listFavoritesStmt.all().map(rowToVideo)
    },
    // duration / published_at が未取得の ended 動画 ID を返す（バックフィル対象）
    listBackfillTargetIds() {
      return backfillTargetIdsStmt.all().map((row) => row.id)
    },
    // 手動登録された未終了の動画 ID（スケジューラの再チェック対象）
    listManualTrackingIds() {
      return manualTrackingIdsStmt.all().map((row) => row.id)
    },
    listFeed(limit = 50) {
      return listFeedStmt.all({ limit }).map(rowToVideo)
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
    }
  }
}
