/**
 * useTabState — タブ別データ管理フック
 *
 * 責務:
 *   - missed / archive / favorites タブの動画リスト取得・更新
 *   - アーカイブ無限スクロール（IntersectionObserver + 検索デバウンス）
 *   - 検索クエリ・チャンネルフィルター状態
 *   - ピン済みチャンネル管理
 *   - タブ横断の動画パッチ（toggleFavorite / toggleNotify / markViewed）
 *
 * @param {{ live: object[], upcoming: object[], updateVideo: (id, patch) => void }} deps
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

// ===== 定数 =====================================================================
// アーカイブ 1 ページあたりの取得件数。ネットワーク負荷とスクロール体験のバランスで 50 に設定
const ARCHIVE_LIMIT = 50
// 全文検索の最大件数。検索ヒット数に上限を設けてメモリ使用を抑える
const SEARCH_LIMIT = 200
// searchByText に渡すターゲットフラグ。description は情報量が多く FTS が遅くなるため除外
const SEARCH_TARGETS = { title: true, channel: true, description: false }

// ===== フック本体 ================================================================
export function useTabState({ live, upcoming, updateVideo }) {
  // ---- タブ選択 ----------------------------------------------------------------
  const [activeTab, setActiveTab] = useState('schedule')

  // ---- タブ別動画リスト --------------------------------------------------------
  const [missedVideos, setMissedVideos] = useState([])
  const [archiveVideos, setArchiveVideos] = useState([])
  const [archiveHasMore, setArchiveHasMore] = useState(false)
  const [archiveLoadingMore, setArchiveLoadingMore] = useState(false)
  const [favoriteVideos, setFavoriteVideos] = useState([])
  const [tabLoading, setTabLoading] = useState(false)

  // ---- アーカイブ無限スクロール用 ref ------------------------------------------
  // offset は setState ではなく ref で管理。setState は非同期なので fetch 直後の値を
  // 次の fetch に渡す際にズレが生じる。ref なら常に最新値を即座に参照できる
  const archiveOffsetRef = useRef(0)
  // 二重ロード防止フラグ。state だと再レンダー前に 2 回目の fetch が走る可能性があるため ref を使用
  const archiveLoadingMoreRef = useRef(false)
  // IntersectionObserver のターゲット DOM ノード
  const archiveSentinelRef = useRef(null)
  // IntersectionObserver コールバックから最新の loadMoreArchive を呼び出すためのコンテナ。
  // observer は mount 時にクロージャを取るため、ref 経由で常に最新の関数を参照する
  const loadMoreArchiveFnRef = useRef(null)

  // ---- 検索・フィルター --------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('all')
  // 検索デバウンス用タイマー・競合リクエスト防止シーケンス
  const archiveSearchTimerRef = useRef(null)
  const archiveSearchSeqRef = useRef(0)

  // ---- ピン済みチャンネル ------------------------------------------------------
  const [pinnedChannelIds, setPinnedChannelIds] = useState(new Set())
  // DB の全チャンネル（アーカイブタブのドロップダウン用）
  const [allDbChannels, setAllDbChannels] = useState([])

  /**
   * DB から全チャンネルを取得してピン済みセットを再構築する。
   * SettingsModal でピン設定が変わったときに親から呼び出す。
   */
  const loadAllDbChannels = useCallback(() => {
    window.api.listAllChannels?.().then((chs) => {
      const channels = chs ?? []
      setPinnedChannelIds(new Set(channels.filter((c) => c.isPinned).map((c) => c.id)))
      setAllDbChannels(channels)
    })
  }, [])

  // 初回マウント時にピン済みチャンネルをロード＆見逃しバッジ用カウント取得
  useEffect(() => {
    loadAllDbChannels()
    window.api.listMissed?.().then((data) => setMissedVideos(data ?? []))
  }, [loadAllDbChannels])

  // ===== アーカイブ追加ロード ===================================================
  async function loadMoreArchive() {
    if (archiveLoadingMoreRef.current) return
    archiveLoadingMoreRef.current = true
    setArchiveLoadingMore(true)
    const offset = archiveOffsetRef.current
    const data = (await window.api.listArchive?.({ limit: ARCHIVE_LIMIT, offset })) ?? []
    archiveOffsetRef.current = offset + data.length
    setArchiveVideos((prev) => [...prev, ...data])
    setArchiveHasMore(data.length === ARCHIVE_LIMIT)
    archiveLoadingMoreRef.current = false
    setArchiveLoadingMore(false)
  }

  // stale closure 対策。IntersectionObserver コールバックが最新の loadMoreArchive を
  // 参照できるよう render 時に同期する（useEffect の deps に含めると observer 再設定が
  // 多発するため、意図的に render サイクルで同期）
  // eslint-disable-next-line react-hooks/refs -- stale closure 対策。render 時同期が必要なパターン
  loadMoreArchiveFnRef.current = loadMoreArchive

  // sentinel が表示領域に入ったら追加ロードを実行する IntersectionObserver
  useEffect(() => {
    if (activeTab !== 'archive' || !archiveHasMore) return
    const sentinel = archiveSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreArchiveFnRef.current?.()
      },
      { rootMargin: '300px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [activeTab, archiveHasMore, archiveVideos.length])

  // ===== アーカイブ検索（デバウンス 300ms）=====================================
  function runArchiveSearch(query) {
    clearTimeout(archiveSearchTimerRef.current)
    archiveSearchTimerRef.current = setTimeout(async () => {
      // seq で競合リクエストを排除。古いリクエストの結果が後から来ても無視する
      const seq = ++archiveSearchSeqRef.current
      setTabLoading(true)
      let data, hasMore
      if (query.trim()) {
        data =
          (await window.api.searchByText?.(query, { ...SEARCH_TARGETS, limit: SEARCH_LIMIT })) ?? []
        hasMore = false
      } else {
        data = (await window.api.listArchive?.({ limit: ARCHIVE_LIMIT, offset: 0 })) ?? []
        hasMore = data.length === ARCHIVE_LIMIT
      }
      if (seq !== archiveSearchSeqRef.current) return
      archiveOffsetRef.current = query.trim() ? 0 : data.length
      setArchiveVideos(data)
      setArchiveHasMore(hasMore)
      setTabLoading(false)
    }, 300)
  }

  // ===== タブ切り替え ==========================================================
  async function handleTabChange(tab) {
    setActiveTab(tab)
    // selectedChannel はリセットしない（存在チェックは tabChannels の useEffect で行う）
    if (tab === 'missed') {
      setTabLoading(true)
      setMissedVideos((await window.api.listMissed?.()) ?? [])
      setTabLoading(false)
    } else if (tab === 'archive') {
      archiveOffsetRef.current = 0
      setArchiveHasMore(false)
      setTabLoading(true)
      // searchQuery は useState の最新値を参照できないため、入力値を引数から取らずに
      // 現時点では空クエリとして初期ロードする。検索は handleSearchQueryChange で別途実行
      const q = searchQuery.trim()
      let data, hasMore
      if (q) {
        data =
          (await window.api.searchByText?.(q, { ...SEARCH_TARGETS, limit: SEARCH_LIMIT })) ?? []
        hasMore = false
      } else {
        data = (await window.api.listArchive?.({ limit: ARCHIVE_LIMIT, offset: 0 })) ?? []
        hasMore = data.length === ARCHIVE_LIMIT
      }
      archiveOffsetRef.current = q ? 0 : data.length
      setArchiveVideos(data)
      setArchiveHasMore(hasMore)
      setTabLoading(false)
    } else if (tab === 'favorites') {
      setTabLoading(true)
      setFavoriteVideos((await window.api.listFavorites?.()) ?? [])
      setTabLoading(false)
    }
  }

  // ===== 検索クエリ変更 =========================================================
  function handleSearchQueryChange(v) {
    setSearchQuery(v)
    // アーカイブタブのみデバウンス検索を実行。他タブはフロントエンドフィルタリングで完結する
    if (activeTab === 'archive') runArchiveSearch(v)
  }

  // ===== タブ横断の動画パッチ ===================================================

  /** 視聴済みマーク切り替え。missedVideos からは削除、他タブは viewedAt を更新 */
  async function handleMarkViewed(id, viewed) {
    if (viewed) {
      await window.api.markViewed?.(id)
    } else {
      await window.api.clearViewed?.(id)
    }
    const patch = { viewedAt: viewed ? Date.now() : null }
    // 見逃しタブは「見た」にすると消す（表示する意味がなくなるため）
    setMissedVideos((prev) => (viewed ? prev.filter((v) => v.id !== id) : prev))
    setArchiveVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
    setFavoriteVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  }

  /** お気に入り切り替え。scheduleタブ（live/upcoming）は useSchedule の updateVideo 経由で更新 */
  async function handleToggleFavorite(id) {
    const newVal = await window.api.toggleFavorite?.(id)
    if (newVal !== null && newVal !== undefined) {
      updateVideo(id, { isFavorite: newVal })
      const patchFn = (v) => (v.id === id ? { ...v, isFavorite: newVal } : v)
      setMissedVideos((prev) => prev.map(patchFn))
      setArchiveVideos((prev) => prev.map(patchFn))
      setFavoriteVideos((prev) => prev.map(patchFn))
    }
  }

  /** チャンネルピン切り替え */
  async function handleTogglePin(channelId) {
    const newVal = await window.api.togglePin?.(channelId)
    if (newVal !== null && newVal !== undefined) {
      setPinnedChannelIds((prev) => {
        const next = new Set(prev)
        if (newVal) next.add(channelId)
        else next.delete(channelId)
        return next
      })
    }
  }

  /** 🔔 通知登録切り替え。全タブの動画リストと useSchedule の live/upcoming を同期 */
  async function handleToggleNotify(id) {
    const newVal = await window.api.toggleNotify?.(id)
    if (newVal !== null && newVal !== undefined) {
      updateVideo(id, { isNotify: newVal })
      const patchFn = (v) => (v.id === id ? { ...v, isNotify: newVal } : v)
      setMissedVideos((prev) => prev.map(patchFn))
      setArchiveVideos((prev) => prev.map(patchFn))
      setFavoriteVideos((prev) => prev.map(patchFn))
    }
  }

  // ===== フィルタリング =========================================================

  /**
   * タブ別チャンネル一覧（フィルタードロップダウン用）。
   * アーカイブタブは DB の全チャンネルを使用。それ以外は表示中データから動的生成。
   * ピン済みを先頭に、その後アルファベット/50音順。
   * 選択中チャンネルが現タブのデータにない場合でも allDbChannels から補完してドロップダウンに残す。
   */
  const tabChannels = useMemo(() => {
    const sortFn = (a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
      return a.title.localeCompare(b.title)
    }
    let channels
    if (activeTab === 'archive') {
      channels = allDbChannels
        .map((c) => ({ id: c.id, title: c.title, isPinned: pinnedChannelIds.has(c.id) }))
        .sort(sortFn)
    } else {
      let source
      if (activeTab === 'schedule') source = [...live, ...upcoming]
      else if (activeTab === 'missed') source = missedVideos
      else if (activeTab === 'favorites') source = favoriteVideos
      else source = []
      const map = new Map()
      for (const item of source) {
        if (!map.has(item.channelId)) map.set(item.channelId, item.channelTitle)
      }
      channels = [...map.entries()]
        .map(([id, title]) => ({ id, title, isPinned: pinnedChannelIds.has(id) }))
        .sort(sortFn)
    }
    // タブに配信がない選択中チャンネルをセレクトBOX最上部に補完して選択状態を維持する
    if (selectedChannel !== 'all' && !channels.some((c) => c.id === selectedChannel)) {
      const dbCh = allDbChannels.find((c) => c.id === selectedChannel)
      if (dbCh) {
        channels = [
          { id: dbCh.id, title: dbCh.title, isPinned: pinnedChannelIds.has(dbCh.id) },
          ...channels
        ]
      }
    }
    return channels
  }, [
    activeTab,
    live,
    upcoming,
    missedVideos,
    favoriteVideos,
    pinnedChannelIds,
    allDbChannels,
    selectedChannel
  ])

  /** 検索ボックスのキーワードに一致するか（schedule タブ用フロントフィルタ） */
  const matchesQuery = useCallback(
    (item) => {
      const q = searchQuery.trim().toLowerCase()
      if (!q) return true
      return (
        (item.title ?? '').toLowerCase().includes(q) ||
        (item.channelTitle ?? '').toLowerCase().includes(q)
      )
    },
    [searchQuery]
  )

  /** チャンネルフィルター + キーワードフィルターを合成 */
  const filterItem = useCallback(
    (item) => {
      const matchesChannel = selectedChannel === 'all' || item.channelId === selectedChannel
      return matchesQuery(item) && matchesChannel
    },
    [matchesQuery, selectedChannel]
  )

  const filteredLive = useMemo(() => live.filter(filterItem), [live, filterItem])
  const filteredUpcoming = useMemo(() => upcoming.filter(filterItem), [upcoming, filterItem])
  const filteredMissed = useMemo(() => missedVideos.filter(filterItem), [missedVideos, filterItem])
  const filteredArchive = useMemo(
    () => archiveVideos.filter(filterItem),
    [archiveVideos, filterItem]
  )
  const filteredFavorites = useMemo(
    () =>
      favoriteVideos
        .filter(filterItem)
        // 未視聴を先頭に固定（お気に入りタブ専用の並び順）
        .sort((a, b) => (a.viewedAt != null ? 1 : 0) - (b.viewedAt != null ? 1 : 0)),
    [favoriteVideos, filterItem]
  )

  // ===== 公開インターフェース ===================================================
  return {
    // タブ選択
    activeTab,
    // タブ別リスト
    missedVideos,
    archiveVideos,
    archiveHasMore,
    archiveLoadingMore,
    favoriteVideos,
    tabLoading,
    // 無限スクロール
    archiveSentinelRef,
    // 検索・フィルター
    searchQuery,
    selectedChannel,
    setSelectedChannel,
    // ピン済みチャンネル
    pinnedChannelIds,
    loadAllDbChannels,
    // タブ別チャンネル一覧（フィルタードロップダウン用）
    tabChannels,
    // フィルタ済みリスト
    filteredLive,
    filteredUpcoming,
    filteredMissed,
    filteredArchive,
    filteredFavorites,
    // ハンドラ
    handleTabChange,
    handleSearchQueryChange,
    handleMarkViewed,
    handleToggleFavorite,
    handleTogglePin,
    handleToggleNotify
  }
}
