import { useState } from 'react'
import PropTypes from 'prop-types'
import ScheduleCard from './ScheduleCard.jsx'

const GROUPS = [
  { key: 'pinned', label: '📌 推し' },
  { key: 'manual', label: '🖐 手動追加' },
  { key: 'other', label: 'その他' }
]

function formatDate(ts) {
  if (!ts) return '配信履歴なし'
  return new Date(ts).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  })
}

function channelUrlOf(channelId) {
  return `https://www.youtube.com/channel/${channelId}`
}

function EmptyState({ children }) {
  return <div className="yt-stats-empty">{children}</div>
}

EmptyState.propTypes = {
  children: PropTypes.node.isRequired
}

const SECTIONS = [
  { key: 'unwatched', label: '推し見落とし' },
  { key: 'silent', label: '沈黙チャンネル' },
  { key: 'ranking', label: '配信頻度ランキング' }
]

export default function StatsTab({
  stats,
  loading = false,
  error = null,
  darkMode = false,
  onToggleNotify,
  onToggleFavorite,
  onTogglePin,
  onDeleteChannel,
  onSyncNow,
  syncing = false
}) {
  const [activeSection, setActiveSection] = useState('unwatched')

  if (loading) return <div className="yt-stats-empty">読み込み中...</div>
  if (error) return <div className="yt-stats-empty">インサイトの読み込みに失敗しました</div>

  const unwatchedPinned = stats?.unwatchedPinned ?? []
  const silentChannels = stats?.silentChannels ?? []
  const frequencyRanking = stats?.frequencyRanking ?? []

  const counts = {
    unwatched: unwatchedPinned.length,
    silent: silentChannels.length,
    ranking: frequencyRanking.length
  }

  return (
    <div className="yt-stats">
      <nav className="yt-stats-subnav" aria-label="インサイトのセクション">
        {SECTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`yt-stats-subnav-btn${activeSection === key ? ' is-active' : ''}`}
            onClick={() => setActiveSection(key)}
          >
            <span>{label}</span>
            <span className="yt-stats-subnav-count">{counts[key]}</span>
          </button>
        ))}
      </nav>

      {activeSection === 'unwatched' && (
        <section className="yt-stats-section">
          <div className="yt-section-label">推し見落としチェック</div>
          <div className="yt-stats-note">推しチャンネル（📌）の直近30日の未視聴配信</div>
          {unwatchedPinned.length === 0 ? (
            <EmptyState>見逃しなし ✨</EmptyState>
          ) : (
            unwatchedPinned.map((item) => (
              <ScheduleCard
                key={item.id}
                item={item}
                darkMode={darkMode}
                watched={item.isNotify}
                isPinned={true}
                onToggleWatch={onToggleNotify}
                onToggleFavorite={onToggleFavorite}
                onTogglePin={onTogglePin}
                showViewedButton={false}
                showDateInTime={true}
              />
            ))
          )}
        </section>
      )}

      {activeSection === 'silent' && (
        <section className="yt-stats-section">
          <div className="yt-section-header">
            <div className="yt-section-label">沈黙チャンネル</div>
            {onSyncNow && (
              <button
                type="button"
                className="yt-action-btn"
                onClick={onSyncNow}
                disabled={syncing}
                title="購読チャンネルを今すぐ再同期（subscriptions.list を即時取得）"
              >
                {syncing ? '同期中…' : '🔄 今すぐ同期'}
              </button>
            )}
          </div>
          <div className="yt-stats-note">
            直近60日以上、配信・動画投稿のないチャンネル。タイトルクリックで YouTube を開く
          </div>
          {silentChannels.length === 0 ? (
            <EmptyState>60日以上活動のないチャンネルはありません</EmptyState>
          ) : (
            GROUPS.map(({ key, label }) => {
              const channels = silentChannels.filter((channel) => channel.category === key)
              return (
                <div key={key} className="yt-stats-group">
                  <div className="yt-stats-group-title">
                    <span>{label}</span>
                    <span className="yt-stats-badge">{channels.length}</span>
                  </div>
                  {channels.length === 0 ? (
                    <div className="yt-stats-row yt-stats-row--muted">該当なし</div>
                  ) : (
                    channels.map((channel) => (
                      <div key={channel.id} className="yt-stats-row">
                        <button
                          type="button"
                          className="yt-stats-row-main yt-stats-row-link"
                          onClick={() => window.api.openExternal?.(channelUrlOf(channel.id))}
                          title="YouTube でチャンネルを開く"
                        >
                          <div className="yt-stats-row-title">{channel.title}</div>
                          <div className="yt-stats-row-meta">
                            最終配信: {formatDate(channel.lastActivityAt)}
                            {channel.silentDays != null && ` / ${channel.silentDays}日`}
                          </div>
                        </button>
                        {channel.isPinned && (
                          <button
                            className="yt-action-btn"
                            onClick={() => onTogglePin?.(channel.id)}
                            title="優先解除"
                          >
                            推し解除
                          </button>
                        )}
                        {channel.isManual && (
                          <button
                            className="yt-action-btn"
                            onClick={() => onDeleteChannel?.(channel.id)}
                            title="手動追加チャンネルを削除"
                          >
                            削除
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )
            })
          )}
        </section>
      )}

      {activeSection === 'ranking' && (
        <section className="yt-stats-section">
          <div className="yt-section-label">配信頻度ランキング</div>
          <div
            className="yt-stats-note"
            title="ライブ・プレミア公開（actual/scheduled start time あり）のみカウント。通常の動画投稿は含みません"
          >
            直近90日の配信件数（ライブ・プレミアのみ）
          </div>
          {frequencyRanking.length === 0 ? (
            <EmptyState>ランキング対象の配信はありません</EmptyState>
          ) : (
            <div className="yt-stats-ranking">
              {frequencyRanking.map((row, index) => (
                <button
                  key={row.channelId}
                  className="yt-stats-rank-row"
                  onClick={() => window.api.openExternal?.(row.channelUrl)}
                >
                  <span className="yt-stats-rank-index">{index + 1}</span>
                  <span className="yt-stats-rank-title">
                    {row.isPinned && <span className="yt-stats-pin">📌</span>}
                    {row.channelTitle}
                  </span>
                  <span className="yt-stats-rank-count">{row.count}件</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

StatsTab.propTypes = {
  stats: PropTypes.shape({
    unwatchedPinned: PropTypes.array,
    silentChannels: PropTypes.array,
    frequencyRanking: PropTypes.array
  }),
  loading: PropTypes.bool,
  error: PropTypes.string,
  darkMode: PropTypes.bool,
  onToggleNotify: PropTypes.func,
  onToggleFavorite: PropTypes.func,
  onTogglePin: PropTypes.func,
  onDeleteChannel: PropTypes.func,
  onSyncNow: PropTypes.func,
  syncing: PropTypes.bool
}
