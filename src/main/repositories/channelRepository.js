export function createChannelRepository(db) {
  const upsertStmt = db.prepare(`
    INSERT INTO channels (id, title, uploads_playlist_id, last_subscription_sync_at)
    VALUES (@id, @title, @uploadsPlaylistId, @syncAt)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      uploads_playlist_id = excluded.uploads_playlist_id,
      last_subscription_sync_at = excluded.last_subscription_sync_at
  `)
  const deleteByIdStmt = db.prepare(`DELETE FROM channels WHERE id = ?`)
  const listAllStmt = db.prepare(`
    SELECT * FROM channels
    ORDER BY is_pinned DESC, id ASC
  `)
  const maxSyncStmt = db.prepare(`SELECT MAX(last_subscription_sync_at) AS ts FROM channels`)
  const togglePinStmt = db.prepare(
    `UPDATE channels SET is_pinned = CASE is_pinned WHEN 1 THEN 0 ELSE 1 END WHERE id = ?`
  )
  const getByIdStmt = db.prepare(`SELECT * FROM channels WHERE id = ?`)
  const listIdsStmt = db.prepare(`SELECT id FROM channels`)

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
    replaceAll(channels, syncAt) {
      const tx = db.transaction(() => {
        const newIds = new Set(channels.map((c) => c.id))
        for (const row of listIdsStmt.all()) {
          if (!newIds.has(row.id)) deleteByIdStmt.run(row.id)
        }
        for (const c of channels) {
          upsertStmt.run({
            id: c.id,
            title: c.title ?? null,
            uploadsPlaylistId: c.uploadsPlaylistId,
            syncAt
          })
        }
      })
      tx()
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
    }
  }
}
