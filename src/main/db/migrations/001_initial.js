export const version = 1

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id                   TEXT PRIMARY KEY,
      channel_id           TEXT NOT NULL,
      channel_title        TEXT NOT NULL,
      title                TEXT NOT NULL,
      description          TEXT,
      thumbnail            TEXT,
      status               TEXT NOT NULL,
      scheduled_start_time INTEGER,
      actual_start_time    INTEGER,
      concurrent_viewers   INTEGER,
      url                  TEXT NOT NULL,
      first_seen_at        INTEGER NOT NULL,
      last_checked_at      INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_videos_status_sched ON videos(status, scheduled_start_time);
    CREATE INDEX IF NOT EXISTS idx_videos_channel      ON videos(channel_id);
    CREATE INDEX IF NOT EXISTS idx_videos_actual_start ON videos(actual_start_time);

    CREATE TABLE IF NOT EXISTS channels (
      id                        TEXT PRIMARY KEY,
      title                     TEXT,
      uploads_playlist_id       TEXT NOT NULL,
      last_subscription_sync_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rss_fetch_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id    TEXT NOT NULL,
      fetched_at    INTEGER NOT NULL,
      success       INTEGER NOT NULL,
      http_status   INTEGER,
      error_message TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_rss_log_time ON rss_fetch_log(fetched_at);

    CREATE TABLE IF NOT EXISTS meta (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)
}
