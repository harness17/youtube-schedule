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

/**
 * 設定インポート用 JSON の形式を検証する。
 * settings か pinnedChannels の少なくとも一方が存在し、
 * favorites キーを持たないことを確認する（お気に入りファイルの誤投入防止）。
 */
export function validateSettingsImport(data) {
  validateImportData(data)
  if ('favorites' in data) {
    throw new Error('このファイルはお気に入りのエクスポートです。設定インポートには使用できません')
  }
  if (!('settings' in data) && !('pinnedChannels' in data)) {
    throw new Error('settings または pinnedChannels が含まれていません')
  }
}

/**
 * お気に入りインポート用 JSON の形式を検証する。
 * favorites 配列が存在し、settings キーを持たないことを確認する（設定ファイルの誤投入防止）。
 */
export function validateFavoritesImport(data) {
  validateImportData(data)
  if ('settings' in data || 'pinnedChannels' in data) {
    throw new Error('このファイルは設定のエクスポートです。お気に入りインポートには使用できません')
  }
  if (!Array.isArray(data.favorites)) {
    throw new Error('favorites 配列が含まれていません')
  }
}

export function buildFavoritesExport(favorites) {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    favorites: favorites.map(({ id, title, channelId, channelTitle, viewedAt }) => ({
      id,
      title,
      channelId,
      channelTitle,
      viewedAt: viewedAt ?? null
    }))
  }
}

/**
 * @param {object} data - インポートJSON
 * @param {(entry: { id: string, title: string, channelId: string, channelTitle: string, viewedAt: number|null }) => boolean|null} importEntry
 *   動画をDBに登録する関数。動画が存在しない場合もスタブ挿入して登録できる。
 *   成功なら true、登録不能なら null を返す。
 * @returns {{ applied: number, skipped: number }}
 */
export function applyFavoritesImport(data, importEntry) {
  validateFavoritesImport(data)
  const list = data.favorites
  let applied = 0
  let skipped = 0
  for (const entry of list) {
    if (!entry?.id) {
      skipped++
      continue
    }
    const result = importEntry(entry)
    if (result != null) {
      applied++
    } else {
      skipped++
    }
  }
  return { applied, skipped }
}
