export function createMetaRepository(db) {
  const getStmt = db.prepare(`SELECT value FROM meta WHERE key = ?`)
  const setStmt = db.prepare(`
    INSERT INTO meta (key, value, updated_at) VALUES (@key, @value, @updatedAt)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `)

  return {
    get(key) {
      const row = getStmt.get(key)
      return row ? row.value : null
    },
    set(key, value, updatedAt = Date.now()) {
      setStmt.run({ key, value, updatedAt })
    }
  }
}
