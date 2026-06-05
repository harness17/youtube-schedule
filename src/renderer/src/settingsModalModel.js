export const SETTINGS_TABS = [
  { key: 'display', label: '🎨 表示' },
  { key: 'channels', label: '📌 チャンネル' },
  { key: 'data', label: '📦 データ' },
  { key: 'connection', label: '🔌 接続' },
  { key: 'about', label: 'ℹ️ アプリ情報' }
]

export const SETTINGS_TAB_KEYS = SETTINGS_TABS.map((tab) => tab.key)

export function sortSettingsChannels(list) {
  return [...list].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return (a.title ?? '').localeCompare(b.title ?? '', 'ja')
  })
}

export function getSettingsChannelGroups(channels, query = '') {
  const normalizedQuery = query.toLowerCase()
  return {
    subscriptionChannels: channels.filter(
      (channel) =>
        !channel.isManual &&
        (normalizedQuery === '' || (channel.title ?? '').toLowerCase().includes(normalizedQuery))
    ),
    manualChannels: channels.filter((channel) => channel.isManual)
  }
}

export function manualVideoSuccessMessage(video) {
  return `「${video?.title ?? '動画'}」を追加しました`
}

export function manualVideoErrorMessage(errorCode) {
  return (
    {
      INVALID_INPUT: 'URL または動画 ID の形式が正しくありません',
      NOT_AUTHENTICATED: 'ログインが必要です。接続タブからログインしてください',
      NOT_FOUND: '動画が見つかりません。非公開、またはこのアカウントで視聴できない可能性があります',
      FETCH_FAILED: '取得に失敗しました。時間をおいて再試行してください'
    }[errorCode] ?? '追加に失敗しました'
  )
}
