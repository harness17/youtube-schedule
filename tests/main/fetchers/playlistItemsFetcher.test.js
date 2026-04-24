import { describe, it, expect, vi } from 'vitest'
import { createPlaylistItemsFetcher } from '../../../src/main/fetchers/playlistItemsFetcher'

describe('PlaylistItemsFetcher', () => {
  it('returns videoIds on success', async () => {
    const yt = {
      playlistItems: {
        list: vi.fn().mockResolvedValue({
          data: {
            items: [{ contentDetails: { videoId: 'V1' } }, { contentDetails: { videoId: 'V2' } }]
          }
        })
      }
    }
    const fetcher = createPlaylistItemsFetcher()
    const ids = await fetcher.fetch(yt, 'UU123')
    expect(ids).toEqual(['V1', 'V2'])
  })

  it('returns [] on API error', async () => {
    const yt = {
      playlistItems: { list: vi.fn().mockRejectedValue(new Error('boom')) }
    }
    const fetcher = createPlaylistItemsFetcher()
    const ids = await fetcher.fetch(yt, 'UU123')
    expect(ids).toEqual([])
  })

  it('returns [] on timeout', async () => {
    const yt = {
      playlistItems: {
        list: vi.fn().mockImplementation(() => new Promise(() => {}))
      }
    }
    const fetcher = createPlaylistItemsFetcher({ timeoutMs: 50 })
    const ids = await fetcher.fetch(yt, 'UU123')
    expect(ids).toEqual([])
  })
})
