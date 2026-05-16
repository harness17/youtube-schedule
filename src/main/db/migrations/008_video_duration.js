export const version = 8

export function up(db) {
  db.exec(`
    ALTER TABLE videos ADD COLUMN duration INTEGER;
  `)
}
