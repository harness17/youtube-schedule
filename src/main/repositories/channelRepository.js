export function createChannelRepository(db) {
  const upsertSubStmt = db.prepare(`
    INSERT INTO channels (id, title, uploads_playlist_id, last_subscription_sync_at)
    VALUES (@id, @title, @uploadsPlaylistId, @syncAt)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      uploads_playlist_id = excluded.uploads_playlist_id,
      last_subscription_sync_at = excluded.last_subscription_sync_at
  `)
  const upsertSeenStmt = db.prepare(`
    INSERT INTO channels (id, title)
    VALUES (@id, @title)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title
  `)
  const upsertManualStmt = db.prepare(`
    INSERT INTO channels (id, title, uploads_playlist_id)
    VALUES (@id, @title, @uploadsPlaylistId)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      uploads_playlist_id = COALESCE(channels.uploads_playlist_id, excluded.uploads_playlist_id)
  `)
  const listAllStmt = db.prepare(`
    SELECT * FROM channels
    ORDER BY is_pinned DESC, id ASC
  `)
  const maxSyncStmt = db.prepare(`
    SELECT MAX(last_subscription_sync_at) AS ts FROM channels
    WHERE uploads_playlist_id IS NOT NULL
  `)
  const togglePinStmt = db.prepare(
    `UPDATE channels SET is_pinned = CASE is_pinned WHEN 1 THEN 0 ELSE 1 END WHERE id = ?`
  )
  const getByIdStmt = db.prepare(`SELECT * FROM channels WHERE id = ?`)

  function rowToChannel(r) {
    return {
      id: r.id,
      title: r.title,
      uploadsPlaylistId: r.uploads_playlist_id,
      lastSubscriptionSyncAt: r.last_subscription_sync_at,
      isPinned: r.is_pinned === 1
    }
  }

  return {
    syncSubscriptions(channels, syncAt) {
      const tx = db.transaction(() => {
        for (const c of channels) {
          upsertSubStmt.run({
            id: c.id,
            title: c.title ?? null,
            uploadsPlaylistId: c.uploadsPlaylistId,
            syncAt
          })
        }
      })
      tx()
    },
    upsertSeen(id, title) {
      upsertSeenStmt.run({ id, title: title ?? null })
    },
    addManual({ id, title, uploadsPlaylistId }) {
      upsertManualStmt.run({
        id,
        title: title ?? id,
        uploadsPlaylistId
      })
      return rowToChannel(getByIdStmt.get(id))
    },
    listAll() {
      return listAllStmt.all().map(rowToChannel)
    },
    getLastSyncTime() {
      return maxSyncStmt.get().ts ?? 0
    },
    togglePin(id) {
      const r = togglePinStmt.run(id)
      if (r.changes === 0) return null
      return getByIdStmt.get(id)?.is_pinned === 1
    },
    replacePinnedChannels(channels) {
      const unpinAll = db.prepare('UPDATE channels SET is_pinned = 0')
      const pinOne = db.prepare('UPDATE channels SET is_pinned = 1 WHERE id = ?')
      const tx = db.transaction(() => {
        unpinAll.run()
        for (const c of channels) {
          upsertSeenStmt.run({ id: c.id, title: c.title ?? null })
          pinOne.run(c.id)
        }
      })
      tx()
    }
  }
}
