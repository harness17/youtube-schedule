import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'
import { runMigrations } from '../../../src/main/db/migrate'
import { createChannelRepository } from '../../../src/main/repositories/channelRepository'

describe('ChannelRepository', () => {
  let db, repo

  beforeEach(() => {
    db = openDatabase(':memory:')
    runMigrations(db)
    repo = createChannelRepository(db)
  })
  afterEach(() => closeDatabase(db))

  it('upserts and lists channels', () => {
    repo.syncSubscriptions(
      [
        { id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' },
        { id: 'UC2', title: 'B', uploadsPlaylistId: 'UU2' }
      ],
      1_700_000_000_000
    )
    const list = repo.listAll()
    expect(list.map((c) => c.id).sort()).toEqual(['UC1', 'UC2'])
  })

  it('syncSubscriptions does not delete channels removed from subscriptions', () => {
    repo.syncSubscriptions([{ id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' }], 1)
    repo.syncSubscriptions([{ id: 'UC2', title: 'B', uploadsPlaylistId: 'UU2' }], 2)
    const ids = repo
      .listAll()
      .map((c) => c.id)
      .sort()
    expect(ids).toEqual(['UC1', 'UC2'])
  })

  it('getLastSyncTime returns 0 when empty', () => {
    expect(repo.getLastSyncTime()).toBe(0)
  })

  it('getLastSyncTime returns the latest sync timestamp for subscribed channels', () => {
    repo.syncSubscriptions([{ id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' }], 1_700_000_000_000)
    expect(repo.getLastSyncTime()).toBe(1_700_000_000_000)
  })

  it('getLastSyncTime ignores upsertSeen channels (no uploadsPlaylistId)', () => {
    repo.syncSubscriptions([{ id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' }], 1_700_000_000_000)
    repo.upsertSeen('UC_SEEN', 'Seen Channel')
    expect(repo.getLastSyncTime()).toBe(1_700_000_000_000)
  })

  it('togglePin flips is_pinned and listAll sorts pinned first', () => {
    repo.syncSubscriptions(
      [
        { id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' },
        { id: 'UC2', title: 'B', uploadsPlaylistId: 'UU2' }
      ],
      1
    )
    expect(repo.togglePin('UC2')).toBe(true)
    const list = repo.listAll()
    expect(list[0].id).toBe('UC2')
    expect(list[0].isPinned).toBe(true)
    expect(list[1].isPinned).toBe(false)
    expect(repo.togglePin('UC2')).toBe(false)
  })

  it('togglePin returns null for unknown channel', () => {
    expect(repo.togglePin('missing')).toBeNull()
  })

  it('syncSubscriptions preserves is_pinned for existing channels', () => {
    repo.syncSubscriptions(
      [
        { id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' },
        { id: 'UC2', title: 'B', uploadsPlaylistId: 'UU2' }
      ],
      1
    )
    repo.togglePin('UC1')
    repo.syncSubscriptions(
      [
        { id: 'UC1', title: 'A renamed', uploadsPlaylistId: 'UU1' },
        { id: 'UC3', title: 'C', uploadsPlaylistId: 'UU3' }
      ],
      2
    )
    const list = repo.listAll()
    const uc1 = list.find((c) => c.id === 'UC1')
    expect(uc1.isPinned).toBe(true)
    expect(uc1.title).toBe('A renamed')
    // UC2 はサブスク外でも残る
    expect(list.find((c) => c.id === 'UC2')).toBeDefined()
    expect(list.find((c) => c.id === 'UC3')).toBeDefined()
  })

  it('upsertSeen adds channel without uploadsPlaylistId', () => {
    repo.upsertSeen('UC_SEEN', 'Auto Seen Channel')
    const list = repo.listAll()
    const ch = list.find((c) => c.id === 'UC_SEEN')
    expect(ch).toBeDefined()
    expect(ch.title).toBe('Auto Seen Channel')
    expect(ch.uploadsPlaylistId).toBeNull()
  })

  it('upsertSeen updates title but does not overwrite uploadsPlaylistId of subscribed channel', () => {
    repo.syncSubscriptions([{ id: 'UC1', title: 'Old', uploadsPlaylistId: 'UU1' }], 1)
    repo.upsertSeen('UC1', 'New Name')
    const ch = repo.listAll().find((c) => c.id === 'UC1')
    expect(ch.title).toBe('New Name')
    expect(ch.uploadsPlaylistId).toBe('UU1')
  })

  it('upsertSeen preserves is_pinned', () => {
    repo.upsertSeen('UC_SEEN', 'Channel')
    repo.togglePin('UC_SEEN')
    repo.upsertSeen('UC_SEEN', 'Channel Updated')
    const ch = repo.listAll().find((c) => c.id === 'UC_SEEN')
    expect(ch.isPinned).toBe(true)
  })

  it('replacePinnedChannels: 指定チャンネルをピン、それ以外をアンピンする', () => {
    repo.syncSubscriptions(
      [
        { id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' },
        { id: 'UC2', title: 'B', uploadsPlaylistId: 'UU2' },
        { id: 'UC3', title: 'C', uploadsPlaylistId: 'UU3' }
      ],
      1
    )
    repo.togglePin('UC1')
    repo.replacePinnedChannels([
      { id: 'UC2', title: 'B' },
      { id: 'UC3', title: 'C' }
    ])
    const list = repo.listAll()
    const byId = Object.fromEntries(list.map((c) => [c.id, c]))
    expect(byId.UC1.isPinned).toBe(false)
    expect(byId.UC2.isPinned).toBe(true)
    expect(byId.UC3.isPinned).toBe(true)
  })

  it('replacePinnedChannels: DB に存在しないチャンネルは upsert してピンする', () => {
    repo.replacePinnedChannels([{ id: 'UC_NEW', title: 'New Channel' }])
    const list = repo.listAll()
    const found = list.find((c) => c.id === 'UC_NEW')
    expect(found).toBeDefined()
    expect(found.isPinned).toBe(true)
  })
})
