export function createChannelRepository(db) {
  const upsertSubStmt = db.prepare(`
    INSERT INTO channels (id, title, uploads_playlist_id, last_subscription_sync_at)
    VALUES (@id, @title, @uploadsPlaylistId, @syncAt)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      uploads_playlist_id = excluded.uploads_playlist_id,
      last_subscription_sync_at = excluded.last_subscription_sync_at,
      deleted_at = NULL
  `)
  const upsertSeenStmt = db.prepare(`
    INSERT INTO channels (id, title)
    VALUES (@id, @title)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title
  `)
  const upsertManualStmt = db.prepare(`
    INSERT INTO channels (id, title, uploads_playlist_id, is_manual)
    VALUES (@id, @title, @uploadsPlaylistId, 1)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      uploads_playlist_id = COALESCE(channels.uploads_playlist_id, excluded.uploads_playlist_id),
      is_manual = 1,
      deleted_at = NULL
  `)
  const listAllStmt = db.prepare(`
    SELECT * FROM channels
    WHERE deleted_at IS NULL
    ORDER BY is_pinned DESC, id ASC
  `)
  // 論理削除済みチャンネルも MAX に含める。これは「購読同期を最後に実行した時刻」を
  // 表す値で、その後チャンネルが削除されたかどうかとは独立。除外すると全購読解除時に
  // 24h キャッシュが無効化され subscriptions.list を呼び続けるため、含める。
  const maxSyncStmt = db.prepare(`
    SELECT MAX(last_subscription_sync_at) AS ts FROM channels
    WHERE uploads_playlist_id IS NOT NULL
  `)
  const togglePinStmt = db.prepare(
    `UPDATE channels SET is_pinned = CASE is_pinned WHEN 1 THEN 0 ELSE 1 END WHERE id = ?`
  )
  // 手動削除は明示的な意思表示なので、is_pinned も落とす（再購読でも📌は復活しない）。
  // 同期削除（syncSubscriptions 内）は is_pinned を保持し、再購読時に📌を復活させる。
  const deleteStmt = db.prepare(
    `UPDATE channels SET deleted_at = @deletedAt, is_pinned = 0 WHERE id = @id AND deleted_at IS NULL`
  )
  const getByIdStmt = db.prepare(`SELECT * FROM channels WHERE id = ?`)

  function rowToChannel(r) {
    return {
      id: r.id,
      title: r.title,
      uploadsPlaylistId: r.uploads_playlist_id,
      lastSubscriptionSyncAt: r.last_subscription_sync_at,
      isPinned: r.is_pinned === 1,
      isManual: r.is_manual === 1
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
        // 購読一覧から消えたチャンネルを論理削除する。
        // 手動追加チャンネル（is_manual=1）は同期削除の対象外。
        // 空配列のときは取得失敗の可能性があるため、何も削除しない。
        if (channels.length > 0) {
          const ids = channels.map((c) => c.id)
          const placeholders = ids.map(() => '?').join(', ')
          db.prepare(
            `UPDATE channels SET deleted_at = ?
             WHERE deleted_at IS NULL AND is_manual = 0
               AND id NOT IN (${placeholders})`
          ).run(syncAt, ...ids)
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
    delete(id) {
      const r = deleteStmt.run({ id, deletedAt: Date.now() })
      return r.changes > 0
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
