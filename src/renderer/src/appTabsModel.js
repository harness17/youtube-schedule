export const APP_TABS = [
  { key: 'feed', label: '新着動画', mode: 'simple' },
  { key: 'schedule', label: '予定・ライブ', mode: 'full' },
  { key: 'missed', label: '見逃し', mode: 'full' },
  { key: 'archive', label: 'アーカイブ', mode: 'full' },
  { key: 'stats', label: '💡 インサイト', mode: 'full' },
  { key: 'favorites', label: '⭐ お気に入り', mode: 'both' },
  { key: 'playlist', label: '📂 プレイリスト', mode: 'full' }
]

export function getVisibleTabs(isAuthenticated) {
  return APP_TABS.filter(
    (tab) => tab.mode === 'both' || (isAuthenticated ? tab.mode === 'full' : tab.mode === 'simple')
  )
}
