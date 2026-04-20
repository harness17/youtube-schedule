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
    repo.replaceAll(
      [
        { id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' },
        { id: 'UC2', title: 'B', uploadsPlaylistId: 'UU2' }
      ],
      1_700_000_000_000
    )
    const list = repo.listAll()
    expect(list.map((c) => c.id).sort()).toEqual(['UC1', 'UC2'])
  })

  it('replaceAll deletes channels not in the new set', () => {
    repo.replaceAll([{ id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' }], 1)
    repo.replaceAll([{ id: 'UC2', title: 'B', uploadsPlaylistId: 'UU2' }], 2)
    const list = repo.listAll()
    expect(list.map((c) => c.id)).toEqual(['UC2'])
  })

  it('getLastSyncTime returns 0 when empty', () => {
    expect(repo.getLastSyncTime()).toBe(0)
  })

  it('getLastSyncTime returns the latest sync timestamp', () => {
    repo.replaceAll([{ id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' }], 1_700_000_000_000)
    expect(repo.getLastSyncTime()).toBe(1_700_000_000_000)
  })

  it('togglePin flips is_pinned and listAll sorts pinned first', () => {
    repo.replaceAll(
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

  it('replaceAll preserves is_pinned for channels still subscribed', () => {
    repo.replaceAll(
      [
        { id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' },
        { id: 'UC2', title: 'B', uploadsPlaylistId: 'UU2' }
      ],
      1
    )
    repo.togglePin('UC1')
    repo.replaceAll(
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
    expect(list.find((c) => c.id === 'UC2')).toBeUndefined()
  })
})
