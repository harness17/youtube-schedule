export const version = 12

export function up(db) {
  db.exec(`
    ALTER TABLE videos ADD COLUMN in_playlist INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE videos ADD COLUMN playlist_added_at INTEGER;
    ALTER TABLE videos ADD COLUMN playlist_removed_at INTEGER;

    CREATE INDEX IF NOT EXISTS idx_videos_in_playlist ON videos(in_playlist);
    CREATE INDEX IF NOT EXISTS idx_videos_playlist_removed ON videos(playlist_removed_at);

    CREATE TABLE IF NOT EXISTS playlist_sync_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      playlist_id TEXT NOT NULL,
      playlist_title TEXT,
      last_synced_at INTEGER,
      enabled INTEGER NOT NULL DEFAULT 1
    );
  `)
}
