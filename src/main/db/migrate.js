import { migrations } from './schema.js'

function ensureTracking(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    )
  `)
}

export function getSchemaVersion(db) {
  ensureTracking(db)
  const row = db.prepare(`SELECT MAX(version) AS v FROM schema_version`).get()
  return row?.v ?? 0
}

export function runMigrations(db) {
  ensureTracking(db)
  const current = getSchemaVersion(db)
  const stmt = db.prepare(`INSERT INTO schema_version (version) VALUES (?)`)
  for (const migration of migrations) {
    if (migration.version <= current) continue
    const tx = db.transaction(() => {
      migration.up(db)
      stmt.run(migration.version)
    })
    tx()
  }
}
