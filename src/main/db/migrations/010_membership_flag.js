export const version = 10

export function up(db) {
  db.exec(`
    ALTER TABLE videos ADD COLUMN is_membership_only INTEGER NOT NULL DEFAULT 0;
  `)
}
