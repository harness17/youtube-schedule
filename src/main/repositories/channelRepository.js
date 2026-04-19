export function createChannelRepository(db) {
  const deleteAll = db.prepare(`DELETE FROM channels`)
  const insert = db.prepare(`
    INSERT INTO channels (id, title, uploads_playlist_id, last_subscription_sync_at)
    VALUES (@id, @title, @uploadsPlaylistId, @syncAt)
  `)
  const listAllStmt = db.prepare(`SELECT * FROM channels ORDER BY id`)
  const maxSyncStmt = db.prepare(
    `SELECT MAX(last_subscription_sync_at) AS ts FROM channels`
  )

  return {
    replaceAll(channels, syncAt) {
      const tx = db.transaction(() => {
        deleteAll.run()
        for (const c of channels) {
          insert.run({
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
      return listAllStmt.all().map((r) => ({
        id: r.id,
        title: r.title,
        uploadsPlaylistId: r.uploads_playlist_id,
        lastSubscriptionSyncAt: r.last_subscription_sync_at
      }))
    },
    getLastSyncTime() {
      return maxSyncStmt.get().ts ?? 0
    }
  }
}
