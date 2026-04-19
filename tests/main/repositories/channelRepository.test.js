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
    repo.replaceAll(
      [{ id: 'UC1', title: 'A', uploadsPlaylistId: 'UU1' }],
      1_700_000_000_000
    )
    expect(repo.getLastSyncTime()).toBe(1_700_000_000_000)
  })
})
