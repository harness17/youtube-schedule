import { rowToVideo } from './videoRepository.js'
import { buildWatchUrl } from '../services/videoUrl.js'

function uniqueVideoIds(ids) {
  if (!Array.isArray(ids)) return []
  return [...new Set(ids.filter((id) => typeof id === 'string' && id.trim()))]
}

function rowToConfig(row) {
  if (!row) return null
  return {
    playlistId: row.playlist_id,
    playlistTitle: row.playlist_title ?? null,
    lastSyncedAt: row.last_synced_at ?? null,
    enabled: row.enabled === 1
  }
}

export function createPlaylistRepository(db) {
  const getConfigStmt = db.prepare(`SELECT * FROM playlist_sync_config WHERE id = 1`)
  const setConfigStmt = db.prepare(`
    INSERT INTO playlist_sync_config (id, playlist_id, playlist_title, enabled)
    VALUES (1, @playlistId, @playlistTitle, @enabled)
    ON CONFLICT(id) DO UPDATE SET
      playlist_id = excluded.playlist_id,
      playlist_title = excluded.playlist_title,
      enabled = excluded.enabled
  `)
  const updateLastSyncedStmt = db.prepare(`
    UPDATE playlist_sync_config SET last_synced_at = @timestamp WHERE id = 1
  `)
  const listAllStmt = db.prepare(`
    SELECT * FROM videos
    WHERE in_playlist = 1 OR playlist_removed_at IS NOT NULL
    ORDER BY
      CASE WHEN playlist_removed_at IS NOT NULL THEN 1 ELSE 0 END,
      COALESCE(playlist_added_at, last_checked_at) DESC,
      id ASC
  `)
  const listRemovedStmt = db.prepare(`
    SELECT * FROM videos
    WHERE playlist_removed_at IS NOT NULL
    ORDER BY playlist_removed_at DESC, id ASC
  `)
  const insertStubStmt = db.prepare(`
    INSERT OR IGNORE INTO videos (
      id, channel_id, channel_title, title, description, thumbnail,
      status, url, first_seen_at, last_checked_at
    ) VALUES (
      @id, '', '', '', '', '',
      'ended', @url, @now, @now
    )
  `)
  const markInPlaylistStmt = db.prepare(`
    UPDATE videos
    SET in_playlist = 1,
        playlist_added_at = COALESCE(playlist_added_at, @now),
        playlist_removed_at = NULL
    WHERE id = @id
  `)
  const markRemovedStmt = db.prepare(`
    UPDATE videos
    SET in_playlist = 0,
        playlist_removed_at = COALESCE(playlist_removed_at, @now)
    WHERE id = @id
  `)
  const deleteRemovedStmt = db.prepare(`
    DELETE FROM videos
    WHERE in_playlist = 0 AND playlist_removed_at IS NOT NULL
  `)
  const deleteOneRemovedStmt = db.prepare(`
    DELETE FROM videos
    WHERE id = @id AND in_playlist = 0 AND playlist_removed_at IS NOT NULL
  `)
  const clearAllPlaylistFlagsStmt = db.prepare(`
    UPDATE videos
    SET in_playlist = 0,
        playlist_added_at = NULL,
        playlist_removed_at = NULL
  `)
  const playlistVideoIdsStmt = db.prepare(`SELECT id FROM videos WHERE in_playlist = 1`)
  const removedPlaylistVideoIdsStmt = db.prepare(`
    SELECT id FROM videos WHERE playlist_removed_at IS NOT NULL
  `)

  const applyDiffTx = db.transaction(({ added, removed, restored, now }) => {
    for (const id of added) {
      insertStubStmt.run({ id, url: buildWatchUrl(id), now })
      markInPlaylistStmt.run({ id, now })
    }
    for (const id of removed) {
      markRemovedStmt.run({ id, now })
    }
    for (const id of restored) {
      insertStubStmt.run({ id, url: buildWatchUrl(id), now })
      markInPlaylistStmt.run({ id, now })
    }
  })

  return {
    getConfig() {
      return rowToConfig(getConfigStmt.get())
    },
    setConfig({ playlistId, playlistTitle = null, enabled = true }) {
      setConfigStmt.run({
        playlistId,
        playlistTitle,
        enabled: enabled ? 1 : 0
      })
    },
    updateLastSyncedAt(timestamp) {
      updateLastSyncedStmt.run({ timestamp })
    },
    listPlaylistVideos({ filter = 'all' } = {}) {
      if (filter === 'removed') return listRemovedStmt.all().map(rowToVideo)
      if (filter === 'all') return listAllStmt.all().map(rowToVideo)
      throw new Error(`Unsupported playlist filter: ${filter}`)
    },
    applyDiff({ added = [], removed = [], restored = [] } = {}, now = Date.now()) {
      applyDiffTx({
        added: uniqueVideoIds(added),
        removed: uniqueVideoIds(removed),
        restored: uniqueVideoIds(restored),
        now
      })
    },
    deleteRemoved() {
      const result = deleteRemovedStmt.run()
      return { deleted: result.changes }
    },
    deleteOne(videoId) {
      const result = deleteOneRemovedStmt.run({ id: videoId })
      return { deleted: result.changes }
    },
    clearAllPlaylistFlags() {
      const result = clearAllPlaylistFlagsStmt.run()
      return { cleared: result.changes }
    },
    getPlaylistVideoIds() {
      return new Set(playlistVideoIdsStmt.all().map((row) => row.id))
    },
    getRemovedPlaylistVideoIds() {
      return new Set(removedPlaylistVideoIdsStmt.all().map((row) => row.id))
    }
  }
}
