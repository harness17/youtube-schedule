import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

// クォータリセット予定時刻を JST で表示用に整形する。
function formatResetTime(resetAt) {
  if (!resetAt) return ''
  return new Date(resetAt).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function StatusBanners({ dbBroken, isOffline }) {
  const [rssFailureRate, setRssFailureRate] = useState(0)
  const [quota, setQuota] = useState({ exceeded: false, resetAt: null })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const rate = await window.api.getRssFailureRate()
      if (mounted) setRssFailureRate(rate)
    }
    load()
    const id = setInterval(load, 10 * 60 * 1000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const status = await window.api.getQuotaStatus?.()
      if (mounted && status) setQuota(status)
    }
    load()
    const id = setInterval(load, 5 * 60 * 1000)
    // refresh 完了時（クォータ超過を含む）に即座に再確認し、バナーを素早く反映する
    const off = window.api.onScheduleUpdated?.(load)
    return () => {
      mounted = false
      clearInterval(id)
      off?.()
    }
  }, [])

  return (
    <div className="status-banners">
      {dbBroken && (
        <div role="alert" className="banner banner--error">
          データベースが破損しています。「リセット」ボタンで再作成してください。
          <button onClick={() => window.api.resetDatabase?.()}>リセット</button>
        </div>
      )}
      {quota.exceeded && (
        <div role="alert" className="banner banner--error">
          YouTube API のクォータ上限に達しました。新しい配信情報の取得は
          {formatResetTime(quota.resetAt)} 頃に自動で回復します。
        </div>
      )}
      {isOffline && (
        <div role="status" className="banner banner--info">
          オフラインです。キャッシュ表示中。
        </div>
      )}
      {rssFailureRate > 0.8 && (
        <div role="status" className="banner banner--warning">
          RSS 取得失敗率が高くなっています（{Math.round(rssFailureRate * 100)}%）。
          クォータ消費増加にご注意ください。
        </div>
      )}
    </div>
  )
}

StatusBanners.propTypes = {
  dbBroken: PropTypes.bool,
  isOffline: PropTypes.bool
}
