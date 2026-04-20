export const version = 4

export function up(db) {
  db.exec(`
    ALTER TABLE videos ADD COLUMN notify INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_videos_notify ON videos(notify);
  `)
}
