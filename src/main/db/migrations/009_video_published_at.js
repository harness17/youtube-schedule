export const version = 9

export function up(db) {
  db.exec(`
    ALTER TABLE videos ADD COLUMN published_at INTEGER;
  `)
}
