export const version = 7

export function up(db) {
  db.exec(`
    ALTER TABLE videos ADD COLUMN source TEXT NOT NULL DEFAULT 'api';
    CREATE INDEX IF NOT EXISTS idx_videos_source ON videos(source);
  `)
}
