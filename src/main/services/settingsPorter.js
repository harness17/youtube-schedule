/**
 * 設定・お気に入りのエクスポート/インポートに関する純粋関数。
 * Electron・fs・dialog に依存しない。IPC ハンドラー側でファイル操作と組み合わせる。
 */

export function buildSettingsExport({ settings, pinnedChannels }) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    pinnedChannels
  }
}

export function validateImportData(data) {
  if (!data || typeof data !== 'object') throw new Error('Invalid format')
  if (data.version !== 1) throw new Error(`Unknown version: ${data.version}`)
}

export function buildFavoritesExport(favorites) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    favorites: favorites.map(({ id, title, channelId, channelTitle }) => ({
      id,
      title,
      channelId,
      channelTitle
    }))
  }
}

/**
 * @param {object} data - インポートJSON
 * @param {(id: string) => boolean|null} setFavorite - DBに id を登録する関数。
 *   存在しない id なら null、成功なら true/false を返す。
 * @returns {{ applied: number, skipped: number }}
 */
export function applyFavoritesImport(data, setFavorite) {
  validateImportData(data)
  const list = Array.isArray(data.favorites) ? data.favorites : []
  let applied = 0
  let skipped = 0
  for (const entry of list) {
    if (!entry?.id) {
      skipped++
      continue
    }
    const result = setFavorite(entry.id)
    if (result != null) {
      applied++
    } else {
      skipped++
    }
  }
  return { applied, skipped }
}
