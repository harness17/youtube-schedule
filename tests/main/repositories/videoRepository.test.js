import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { openDatabase, closeDatabase } from '../../../src/main/db/connection'
import { runMigrations } from '../../../src/main/db/migrate'
import { createVideoRepository } from '../../../src/main/repositories/videoRepository'

function sampleVideo(overrides = {}) {
  return {
    id: 'abc123',
    channelId: 'UCxxx',
    channelTitle: 'Test Channel',
    title: 'Test Video',
    description: 'desc',
    thumbnail: 'https://example.com/t.jpg',
    status: 'upcoming',
    scheduledStartTime: Date.now() + 60 * 60 * 1000,
    actualStartTime: null,
    concurrentViewers: null,
    url: 'https://www.youtube.com/watch?v=abc123',
    firstSeenAt: Date.now(),
    lastCheckedAt: Date.now(),
    ...overrides
  }
}

describe('VideoRepository', () => {
  let db, repo

  beforeEach(() => {
    db = openDatabase(':memory:')
    runMigrations(db)
    repo = createVideoRepository(db)
  })
  afterEach(() => closeDatabase(db))

  it('upserts and retrieves a video by id', () => {
    repo.upsert(sampleVideo({ id: 'v1' }))
    const got = repo.getById('v1')
    expect(got).not.toBeNull()
    expect(got.title).toBe('Test Video')
  })

  it('returns null for a missing id', () => {
    expect(repo.getById('missing')).toBeNull()
  })

  it('does not duplicate on repeated upsert', () => {
    repo.upsert(sampleVideo({ id: 'v1' }))
    repo.upsert(sampleVideo({ id: 'v1', title: 'Updated' }))
    expect(repo.count()).toBe(1)
    expect(repo.getById('v1').title).toBe('Updated')
  })

  it('listVisible returns future upcoming and recent live', () => {
    const now = Date.now()
    repo.upsert(sampleVideo({ id: 'up1', status: 'upcoming', scheduledStartTime: now + 3600e3 }))
    repo.upsert(
      sampleVideo({ id: 'up2', status: 'upcoming', scheduledStartTime: now - 3 * 3600e3 })
    )
    repo.upsert(sampleVideo({ id: 'lv1', status: 'live', actualStartTime: now - 3600e3 }))
    repo.upsert(sampleVideo({ id: 'lv2', status: 'live', actualStartTime: now - 25 * 3600e3 }))
    repo.upsert(sampleVideo({ id: 'en1', status: 'ended' }))

    const visible = repo.listVisible(now)
    const ids = visible.map((v) => v.id)
    expect(ids).toContain('up1')
    expect(ids).toContain('lv1')
    expect(ids).not.toContain('up2')
    expect(ids).not.toContain('lv2')
    expect(ids).not.toContain('en1')
  })

  it('boundary: upcoming exactly 2h in the past is excluded', () => {
    const now = 1_700_000_000_000
    repo.upsert(
      sampleVideo({
        id: 'b1',
        status: 'upcoming',
        scheduledStartTime: now - 2 * 3600e3
      })
    )
    expect(repo.listVisible(now).map((v) => v.id)).not.toContain('b1')
  })

  it('boundary: live exactly 24h old is excluded', () => {
    const now = 1_700_000_000_000
    repo.upsert(
      sampleVideo({
        id: 'b2',
        status: 'live',
        actualStartTime: now - 24 * 3600e3
      })
    )
    expect(repo.listVisible(now).map((v) => v.id)).not.toContain('b2')
  })

  it('getByIds returns matching records only', () => {
    repo.upsert(sampleVideo({ id: 'a' }))
    repo.upsert(sampleVideo({ id: 'b' }))
    const got = repo.getByIds(['a', 'z'])
    expect(got.map((v) => v.id)).toEqual(['a'])
  })

  it('deleteExpiredEnded removes ended videos older than threshold', () => {
    const now = 1_700_000_000_000
    repo.upsert(sampleVideo({ id: 'old', status: 'ended', lastCheckedAt: now - 31 * 24 * 3600e3 }))
    repo.upsert(
      sampleVideo({ id: 'fresh', status: 'ended', lastCheckedAt: now - 10 * 24 * 3600e3 })
    )
    const removed = repo.deleteExpiredEnded(now - 30 * 24 * 3600e3)
    expect(removed).toBe(1)
    expect(repo.getById('old')).toBeNull()
    expect(repo.getById('fresh')).not.toBeNull()
  })

  it('deleteExpiredEnded keeps favorited videos even when expired', () => {
    const now = 1_700_000_000_000
    repo.upsert(sampleVideo({ id: 'fav', status: 'ended', lastCheckedAt: now - 90 * 24 * 3600e3 }))
    repo.toggleFavorite('fav')
    const removed = repo.deleteExpiredEnded(now - 30 * 24 * 3600e3)
    expect(removed).toBe(0)
    expect(repo.getById('fav')).not.toBeNull()
  })

  it('upsert sets ended_at when status becomes ended and clears it on revival', () => {
    const t1 = 1_700_000_000_000
    repo.upsert(sampleVideo({ id: 'v1', status: 'ended', lastCheckedAt: t1 }))
    expect(repo.getById('v1').endedAt).toBe(t1)
    repo.upsert(
      sampleVideo({ id: 'v1', status: 'live', actualStartTime: t1, lastCheckedAt: t1 + 10 })
    )
    expect(repo.getById('v1').endedAt).toBeNull()
  })

  it('upsert preserves ended_at on subsequent ended upserts', () => {
    const t1 = 1_700_000_000_000
    repo.upsert(sampleVideo({ id: 'v1', status: 'ended', lastCheckedAt: t1 }))
    repo.upsert(sampleVideo({ id: 'v1', status: 'ended', lastCheckedAt: t1 + 5 * 24 * 3600e3 }))
    expect(repo.getById('v1').endedAt).toBe(t1)
  })

  it('toggleFavorite flips is_favorite', () => {
    repo.upsert(sampleVideo({ id: 'v1' }))
    expect(repo.getById('v1').isFavorite).toBe(false)
    expect(repo.toggleFavorite('v1')).toBe(true)
    expect(repo.getById('v1').isFavorite).toBe(true)
    expect(repo.toggleFavorite('v1')).toBe(false)
    expect(repo.getById('v1').isFavorite).toBe(false)
  })

  it('toggleFavorite returns null for unknown id', () => {
    expect(repo.toggleFavorite('missing')).toBeNull()
  })

  it('upsert does not overwrite is_favorite or viewed_at', () => {
    const now = Date.now()
    repo.upsert(sampleVideo({ id: 'v1', status: 'upcoming' }))
    repo.toggleFavorite('v1')
    repo.markViewed('v1', now)
    repo.upsert(sampleVideo({ id: 'v1', status: 'live', title: 'updated' }))
    const got = repo.getById('v1')
    expect(got.isFavorite).toBe(true)
    expect(got.viewedAt).toBe(now)
    expect(got.title).toBe('updated')
  })

  it('markViewed sets viewedAt and clearViewed clears it', () => {
    const now = 1_700_000_000_000
    repo.upsert(sampleVideo({ id: 'v1' }))
    expect(repo.markViewed('v1', now)).toBe(true)
    expect(repo.getById('v1').viewedAt).toBe(now)
    expect(repo.clearViewed('v1')).toBe(true)
    expect(repo.getById('v1').viewedAt).toBeNull()
  })

  it('listFavorites returns only favorited videos', () => {
    repo.upsert(sampleVideo({ id: 'a' }))
    repo.upsert(sampleVideo({ id: 'b' }))
    repo.upsert(sampleVideo({ id: 'c' }))
    repo.toggleFavorite('a')
    repo.toggleFavorite('c')
    const ids = repo
      .listFavorites()
      .map((v) => v.id)
      .sort()
    expect(ids).toEqual(['a', 'c'])
  })

  it('listMissed returns ended+notify videos that were never viewed', () => {
    const now = 1_700_000_000_000
    // notify=1, not viewed → 見逃し対象
    repo.upsert(
      sampleVideo({
        id: 'missed',
        status: 'ended',
        actualStartTime: now - 3600e3,
        lastCheckedAt: now
      })
    )
    repo.toggleNotify('missed')
    // notify=1, viewed → 見逃し対象外
    repo.upsert(
      sampleVideo({
        id: 'seen',
        status: 'ended',
        actualStartTime: now - 3600e3,
        lastCheckedAt: now
      })
    )
    repo.toggleNotify('seen')
    repo.markViewed('seen', now)
    // notify=0 → 見逃し対象外（フラグなし）
    repo.upsert(
      sampleVideo({
        id: 'no_notify',
        status: 'ended',
        actualStartTime: now - 3600e3,
        lastCheckedAt: now
      })
    )
    // upcoming → 見逃し対象外
    repo.upsert(
      sampleVideo({
        id: 'future',
        status: 'upcoming',
        scheduledStartTime: now + 3600e3
      })
    )
    const ids = repo.listMissed(now).map((v) => v.id)
    expect(ids).toContain('missed')
    expect(ids).not.toContain('seen')
    expect(ids).not.toContain('no_notify')
    expect(ids).not.toContain('future')
  })

  it('toggleNotify flips notify flag', () => {
    repo.upsert(sampleVideo({ id: 'v1' }))
    expect(repo.toggleNotify('v1')).toBe(true)
    expect(repo.getById('v1').isNotify).toBe(true)
    expect(repo.toggleNotify('v1')).toBe(false)
    expect(repo.getById('v1').isNotify).toBe(false)
  })

  it('toggleNotify returns null for unknown id', () => {
    expect(repo.toggleNotify('missing')).toBeNull()
  })

  it('markEnded sets status to ended and records ended_at', () => {
    const now = 1_700_000_000_000
    repo.upsert(sampleVideo({ id: 'v1', status: 'live', actualStartTime: now - 60e3 }))
    expect(repo.markEnded('v1', now)).toBe(true)
    const v = repo.getById('v1')
    expect(v.status).toBe('ended')
    expect(v.endedAt).toBe(now)
  })

  it('markEnded does not overwrite existing ended_at', () => {
    const firstEnd = 1_700_000_000_000
    const later = firstEnd + 3600e3
    repo.upsert(sampleVideo({ id: 'v1', status: 'live', actualStartTime: firstEnd - 60e3 }))
    repo.markEnded('v1', firstEnd)
    repo.markEnded('v1', later)
    expect(repo.getById('v1').endedAt).toBe(firstEnd)
  })

  it('markEnded returns false for already-ended videos', () => {
    const now = 1_700_000_000_000
    repo.upsert(sampleVideo({ id: 'v1', status: 'ended', lastCheckedAt: now }))
    expect(repo.markEnded('v1', now + 1000)).toBe(false)
  })

  it('listArchive returns ended videos sorted by ended_at desc with paging', () => {
    const base = 1_700_000_000_000
    for (let i = 0; i < 5; i += 1) {
      repo.upsert(sampleVideo({ id: `e${i}`, status: 'ended', lastCheckedAt: base - i * 1000 }))
    }
    const page = repo.listArchive({ limit: 2, offset: 0 })
    expect(page.map((v) => v.id)).toEqual(['e0', 'e1'])
    const next = repo.listArchive({ limit: 2, offset: 2 })
    expect(next.map((v) => v.id)).toEqual(['e2', 'e3'])
  })

  it('searchByText がチャンネル名で検索できる', () => {
    repo.upsert(sampleVideo({ id: 'v1', channelTitle: 'ホロライブ公式', title: '雑談', status: 'ended' }))
    repo.upsert(sampleVideo({ id: 'v2', channelTitle: '別のチャンネル', title: 'ホロ雑談', status: 'ended' }))
    // channel=true, title=false → チャンネル名のみ検索
    const ids = repo.searchByText('ホロ', { title: false, channel: true, description: false }).map((v) => v.id)
    expect(ids).toEqual(['v1'])
  })

  it('searchByText のトグルで対象カラムを絞り込める', () => {
    repo.upsert(sampleVideo({ id: 'v1', title: 'テストタイトル', description: 'キーワードあり', status: 'ended' }))
    // タイトルのみ → ヒットしない
    expect(repo.searchByText('キーワード', { title: true, channel: false, description: false })).toEqual([])
    // 説明文のみ → ヒットする
    expect(repo.searchByText('キーワード', { title: false, channel: false, description: true }).map((v) => v.id)).toEqual(['v1'])
  })

  it('searchByText がタイトルの部分一致で ended 動画を返す', () => {
    repo.upsert(sampleVideo({ id: 'v1', title: '地獄の果てまで', status: 'ended' }))
    repo.upsert(sampleVideo({ id: 'v2', title: 'ホロライブ配信', status: 'ended' }))
    repo.upsert(sampleVideo({ id: 'v3', title: '全然関係ないタイトル', status: 'ended' }))
    expect(repo.searchByText('地獄').map((v) => v.id)).toEqual(['v1'])
    expect(repo.searchByText('ホロ').map((v) => v.id)).toEqual(['v2'])
  })

  it('searchByText が説明文の部分一致で ended 動画を返す（description:true 指定時）', () => {
    repo.upsert(
      sampleVideo({ id: 'v1', title: '配信タイトル', description: '今日は地獄コラボです', status: 'ended' })
    )
    expect(repo.searchByText('地獄', { description: true }).map((v) => v.id)).toEqual(['v1'])
  })

  it('searchByText はデフォルトで説明文を検索しない', () => {
    repo.upsert(
      sampleVideo({ id: 'v1', title: '配信タイトル', description: '今日は地獄コラボです', status: 'ended' })
    )
    // デフォルト: title=true, channel=true, description=false
    expect(repo.searchByText('地獄')).toEqual([])
  })

  it('searchByText はタイトルとチャンネル名を同時に検索する', () => {
    repo.upsert(sampleVideo({ id: 'v1', title: 'announcement stream', status: 'ended' }))
    repo.upsert(
      sampleVideo({ id: 'v2', channelTitle: 'announcement channel', title: 'Cooking stream', status: 'ended' })
    )
    repo.upsert(sampleVideo({ id: 'v3', title: 'Random talk', status: 'ended' }))
    const ids = repo.searchByText('announcement').map((v) => v.id).sort()
    expect(ids).toEqual(['v1', 'v2'])
  })

  it('searchByText は ended 以外の動画を返さない', () => {
    repo.upsert(sampleVideo({ id: 'v1', title: 'upcoming stream', status: 'upcoming' }))
    repo.upsert(sampleVideo({ id: 'v2', title: 'live stream', status: 'live' }))
    repo.upsert(sampleVideo({ id: 'v3', title: 'ended stream', status: 'ended' }))
    const ids = repo.searchByText('stream').map((v) => v.id)
    expect(ids).toEqual(['v3'])
  })

  it('searchByText は空・空白クエリで空配列を返す', () => {
    repo.upsert(sampleVideo({ id: 'v1', title: 'hello', status: 'ended' }))
    expect(repo.searchByText('')).toEqual([])
    expect(repo.searchByText('   ')).toEqual([])
  })

  it('searchByText は LIKE 特殊文字（% _）を含むクエリで安全に動作する', () => {
    repo.upsert(sampleVideo({ id: 'v1', title: '100% confirmed', status: 'ended' }))
    repo.upsert(sampleVideo({ id: 'v2', title: 'other video', status: 'ended' }))
    // '100%' で検索すると v1 だけヒット（% がワイルドカードにならない）
    expect(repo.searchByText('100%').map((v) => v.id)).toEqual(['v1'])
    // '%' だけで検索すると % を含む v1 だけヒット（全件ヒットにはならない）
    expect(repo.searchByText('%').map((v) => v.id)).toEqual(['v1'])
    // '_' だけで検索しても _ を含まない動画はヒットしない
    expect(repo.searchByText('_').map((v) => v.id)).toEqual([])
  })
})
