export const version = 5

export function up(db) {
  db.exec(`
    CREATE TABLE channels_new (
      id                        TEXT PRIMARY KEY,
      title                     TEXT,
      uploads_playlist_id       TEXT,
      last_subscription_sync_at INTEGER,
      is_pinned                 INTEGER NOT NULL DEFAULT 0
    );

    INSERT INTO channels_new (id, title, uploads_playlist_id, last_subscription_sync_at, is_pinned)
      SELECT id, title, uploads_playlist_id, last_subscription_sync_at, is_pinned
      FROM channels;

    DROP TABLE channels;
    ALTER TABLE channels_new RENAME TO channels;

    CREATE INDEX IF NOT EXISTS idx_channels_pinned ON channels(is_pinned);
  `)
}
