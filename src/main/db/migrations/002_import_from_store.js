export const version = 2

function toRecord(item, now) {
  return {
    id: item.id,
    channelId: item.channelId ?? '',
    channelTitle: item.channelTitle ?? '',
    title: item.title ?? '',
    description: item.description ?? '',
    thumbnail: item.thumbnail ?? '',
    status: item.status,
    scheduledStartTime: item.scheduledStartTime
      ? new Date(item.scheduledStartTime).getTime()
      : null,
    actualStartTime: item.actualStartTime
      ? new Date(item.actualStartTime).getTime()
      : null,
    concurrentViewers: item.concurrentViewers ?? null,
    url: item.url,
    firstSeenAt: now,
    lastCheckedAt: now
  }
}

export function up(db, ctx = {}) {
  const legacy = ctx.legacyStoreReader?.read?.() || null
  if (!legacy || !legacy.data) return

  const now = Date.now()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO videos (
      id, channel_id, channel_title, title, description, thumbnail,
      status, scheduled_start_time, actual_start_time, concurrent_viewers,
      url, first_seen_at, last_checked_at
    ) VALUES (
      @id, @channelId, @channelTitle, @title, @description, @thumbnail,
      @status, @scheduledStartTime, @actualStartTime, @concurrentViewers,
      @url, @firstSeenAt, @lastCheckedAt
    )
  `)

  const tx = db.transaction(() => {
    for (const item of legacy.data.live || []) insert.run(toRecord(item, now))
    for (const item of legacy.data.upcoming || []) insert.run(toRecord(item, now))
  })
  tx()

  ctx.legacyStoreReader.clear?.()
}
