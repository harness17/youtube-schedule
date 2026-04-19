import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

export default function StatusBanners({ dbBroken, isOffline }) {
  const [rssFailureRate, setRssFailureRate] = useState(0)

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

  return (
    <div className="status-banners">
      {dbBroken && (
        <div role="alert" className="banner banner--error">
          データベースが破損しています。「リセット」ボタンで再作成してください。
          <button onClick={() => window.api.resetDatabase?.()}>リセット</button>
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
