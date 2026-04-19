import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'
import { runMigrations } from '../../../src/main/db/migrate'
import { createMetaRepository } from '../../../src/main/repositories/metaRepository'

describe('MetaRepository', () => {
  let db, repo

  beforeEach(() => {
    db = openDatabase(':memory:')
    runMigrations(db)
    repo = createMetaRepository(db)
  })
  afterEach(() => closeDatabase(db))

  it('returns null for missing key', () => {
    expect(repo.get('nonexistent')).toBeNull()
  })

  it('sets and gets a string value', () => {
    repo.set('foo', 'bar', 1)
    expect(repo.get('foo')).toBe('bar')
  })

  it('set overwrites existing value', () => {
    repo.set('k', 'v1', 1)
    repo.set('k', 'v2', 2)
    expect(repo.get('k')).toBe('v2')
  })
})
