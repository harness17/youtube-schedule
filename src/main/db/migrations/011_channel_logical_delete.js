export const version = 11

export function up(db) {
  db.exec(`
    ALTER TABLE channels ADD COLUMN is_manual INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE channels ADD COLUMN deleted_at INTEGER;

    UPDATE channels SET is_manual = 1
      WHERE last_subscription_sync_at IS NULL
        AND uploads_playlist_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_channels_deleted_at ON channels(deleted_at);
  `)
}
