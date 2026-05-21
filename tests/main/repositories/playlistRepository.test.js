import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'
import { runMigrations } from '../../../src/main/db/migrate'
import { createPlaylistRepository } from '../../../src/main/repositories/playlistRepository'
import { createVideoRepository } from '../../../src/main/repositories/videoRepository'

const NOW = 1_700_000_000_000

function sampleVideo(overrides = {}) {
  const id = overrides.id ?? 'v1'
  return {
    id,
    channelId: overrides.channelId ?? 'UC1',
    channelTitle: overrides.channelTitle ?? 'Channel 1',
    title: overrides.title ?? `Video ${id}`,
    description: overrides.description ?? '',
    thumbnail: overrides.thumbnail ?? 'https://example.com/thumb.jpg',
    status: overrides.status ?? 'ended',
    scheduledStartTime: overrides.scheduledStartTime ?? null,
    actualStartTime: overrides.actualStartTime ?? NOW - 1000,
    concurrentViewers: overrides.concurrentViewers ?? null,
    url: overrides.url ?? `https://www.youtube.com/watch?v=${id}`,
    firstSeenAt: overrides.firstSeenAt ?? NOW - 2000,
    lastCheckedAt: overrides.lastCheckedAt ?? NOW - 1000,
    publishedAt: overrides.publishedAt ?? null,
    ...overrides
  }
}

describe('PlaylistRepository', () => {
  let db, playlistRepo, videoRepo

  beforeEach(() => {
    db = openDatabase(':memory:')
    runMigrations(db)
    playlistRepo = createPlaylistRepository(db)
    videoRepo = createVideoRepository(db)
  })

  afterEach(() => closeDatabase(db))

  it('getConfig returns null before registration', () => {
    expect(playlistRepo.getConfig()).toBeNull()
  })

  it('setConfig upserts the single config row without creating duplicates', () => {
    playlistRepo.setConfig({ playlistId: 'PL1', playlistTitle: 'First', enabled: true })
    playlistRepo.updateLastSyncedAt(NOW)
    playlistRepo.setConfig({ playlistId: 'PL2', playlistTitle: 'Second', enabled: false })

    expect(playlistRepo.getConfig()).toEqual({
      playlistId: 'PL2',
      playlistTitle: 'Second',
      lastSyncedAt: NOW,
      enabled: false
    })
    expect(db.prepare(`SELECT COUNT(*) AS count FROM playlist_sync_config`).get().count).toBe(1)
  })

  it('applyDiff handles added, removed, and restored videos in one diff', () => {
    videoRepo.upsert(sampleVideo({ id: 'existing' }))
    videoRepo.upsert(sampleVideo({ id: 'removed' }))
    playlistRepo.applyDiff({ added: ['existing', 'new'], removed: ['removed'] }, NOW)

    expect(playlistRepo.getPlaylistVideoIds()).toEqual(new Set(['existing', 'new']))
    expect(db.prepare(`SELECT in_playlist FROM videos WHERE id = 'removed'`).get()).toEqual({
      in_playlist: 0
    })
    expect(db.prepare(`SELECT playlist_removed_at FROM videos WHERE id = 'removed'`).get()).toEqual(
      { playlist_removed_at: NOW }
    )

    playlistRepo.applyDiff({ restored: ['removed'] }, NOW + 1000)
    const restored = db
      .prepare(`SELECT in_playlist, playlist_removed_at FROM videos WHERE id = ?`)
      .get('removed')
    expect(restored).toEqual({ in_playlist: 1, playlist_removed_at: null })
  })

  it('applyDiff accepts empty arrays and deduplicates repeated video ids', () => {
    playlistRepo.applyDiff({}, NOW)
    expect(playlistRepo.getPlaylistVideoIds()).toEqual(new Set())

    playlistRepo.applyDiff({ added: ['dup', 'dup', '', '   ', null] }, NOW)
    expect(playlistRepo.getPlaylistVideoIds()).toEqual(new Set(['dup']))
    expect(db.prepare(`SELECT COUNT(*) AS count FROM videos WHERE id = 'dup'`).get().count).toBe(1)
  })

  it('applyDiff lets restored win when the same id is removed and restored', () => {
    videoRepo.upsert(sampleVideo({ id: 'same' }))
    playlistRepo.applyDiff({ added: ['same'] }, NOW)
    playlistRepo.applyDiff({ removed: ['same'], restored: ['same'] }, NOW + 1000)

    const row = db
      .prepare(`SELECT in_playlist, playlist_removed_at FROM videos WHERE id = ?`)
      .get('same')
    expect(row).toEqual({ in_playlist: 1, playlist_removed_at: null })
  })

  it('listPlaylistVideos returns all playlist-managed videos or removed-only videos', () => {
    videoRepo.upsert(sampleVideo({ id: 'active', title: 'Active' }))
    videoRepo.upsert(sampleVideo({ id: 'removed', title: 'Removed' }))
    playlistRepo.applyDiff({ added: ['active', 'removed'] }, NOW)
    playlistRepo.applyDiff({ removed: ['removed'] }, NOW + 1000)

    expect(playlistRepo.listPlaylistVideos().map((video) => video.id)).toEqual([
      'active',
      'removed'
    ])
    expect(playlistRepo.listPlaylistVideos({ filter: 'removed' }).map((video) => video.id)).toEqual(
      ['removed']
    )
  })

  it('deleteRemoved deletes only rows removed from the playlist', () => {
    videoRepo.upsert(sampleVideo({ id: 'active' }))
    videoRepo.upsert(sampleVideo({ id: 'removed' }))
    videoRepo.upsert(sampleVideo({ id: 'inconsistent' }))
    playlistRepo.applyDiff({ added: ['active', 'removed', 'inconsistent'] }, NOW)
    playlistRepo.applyDiff({ removed: ['removed'] }, NOW + 1000)
    db.prepare(`UPDATE videos SET playlist_removed_at = ? WHERE id = 'inconsistent'`).run(NOW)

    expect(playlistRepo.deleteRemoved()).toEqual({ deleted: 1 })
    expect(videoRepo.getById('active')).not.toBeNull()
    expect(videoRepo.getById('removed')).toBeNull()
    expect(videoRepo.getById('inconsistent')).not.toBeNull()
  })
})
