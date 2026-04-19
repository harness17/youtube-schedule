export const version = 3

export function up(db) {
  db.exec(`
    ALTER TABLE videos ADD COLUMN viewed_at INTEGER;
    ALTER TABLE videos ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE videos ADD COLUMN ended_at INTEGER;

    ALTER TABLE channels ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;

    CREATE INDEX IF NOT EXISTS idx_videos_favorite ON videos(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_videos_viewed ON videos(viewed_at);
    CREATE INDEX IF NOT EXISTS idx_videos_ended_at ON videos(ended_at);
    CREATE INDEX IF NOT EXISTS idx_channels_pinned ON channels(is_pinned);

    UPDATE videos
       SET ended_at = last_checked_at
     WHERE status = 'ended' AND ended_at IS NULL;

    CREATE VIRTUAL TABLE IF NOT EXISTS videos_fts USING fts5(
      title,
      description,
      content='videos',
      content_rowid='rowid',
      tokenize='unicode61'
    );

    INSERT INTO videos_fts(rowid, title, description)
      SELECT rowid, title, description FROM videos;

    CREATE TRIGGER IF NOT EXISTS videos_ai AFTER INSERT ON videos BEGIN
      INSERT INTO videos_fts(rowid, title, description)
        VALUES (new.rowid, new.title, new.description);
    END;

    CREATE TRIGGER IF NOT EXISTS videos_ad AFTER DELETE ON videos BEGIN
      INSERT INTO videos_fts(videos_fts, rowid, title, description)
        VALUES ('delete', old.rowid, old.title, old.description);
    END;

    CREATE TRIGGER IF NOT EXISTS videos_au AFTER UPDATE ON videos BEGIN
      INSERT INTO videos_fts(videos_fts, rowid, title, description)
        VALUES ('delete', old.rowid, old.title, old.description);
      INSERT INTO videos_fts(rowid, title, description)
        VALUES (new.rowid, new.title, new.description);
    END;
  `)
}
