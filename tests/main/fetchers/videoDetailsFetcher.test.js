import { describe, it, expect, vi } from 'vitest'
import { createVideoDetailsFetcher } from '../../../src/main/fetchers/videoDetailsFetcher'

function makeYt(batches) {
  let call = 0
  return {
    videos: {
      list: vi.fn().mockImplementation(async () => {
        const data = { items: batches[call] }
        call += 1
        return { data }
      })
    }
  }
}

describe('VideoDetailsFetcher', () => {
  it('returns [] for empty input', async () => {
    const yt = makeYt([])
    const fetcher = createVideoDetailsFetcher()
    expect(await fetcher.fetch(yt, [])).toEqual([])
  })

  it('batches ids in chunks of 50', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `V${i}`)
    const yt = makeYt([ids.slice(0, 50).map((id) => ({ id })), ids.slice(50).map((id) => ({ id }))])
    const fetcher = createVideoDetailsFetcher()
    const result = await fetcher.fetch(yt, ids)
    expect(yt.videos.list).toHaveBeenCalledTimes(2)
    expect(result.map((r) => r.id)).toEqual(ids)
  })

  it('throws on timeout', async () => {
    const yt = {
      videos: {
        list: vi.fn().mockImplementation(() => new Promise(() => {}))
      }
    }
    const fetcher = createVideoDetailsFetcher({ timeoutMs: 50 })
    await expect(fetcher.fetch(yt, ['V1'])).rejects.toThrow('videos.list timeout')
  })
})
