export const version = 6

export function up(db) {
  db.exec(`
    ALTER TABLE videos ADD COLUMN favorite_order INTEGER;
    CREATE INDEX IF NOT EXISTS idx_videos_favorite_order ON videos(is_favorite, favorite_order);
  `)
}
