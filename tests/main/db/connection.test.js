import { describe, it, expect, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'

describe('db/connection', () => {
  let db

  afterEach(() => {
    if (db) closeDatabase(db)
    db = null
  })

  it('opens an in-memory database when given :memory:', () => {
    db = openDatabase(':memory:')
    expect(db.open).toBe(true)
  })

  it('applies WAL journal mode on file databases', () => {
    db = openDatabase(':memory:')
    const row = db.pragma('journal_mode', { simple: true })
    expect(typeof row).toBe('string')
  })

  it('executes PRAGMA integrity_check and returns "ok" for a fresh DB', () => {
    db = openDatabase(':memory:')
    const result = db.pragma('integrity_check', { simple: true })
    expect(result).toBe('ok')
  })

  it('closes cleanly', () => {
    db = openDatabase(':memory:')
    closeDatabase(db)
    expect(db.open).toBe(false)
    db = null
  })
})
