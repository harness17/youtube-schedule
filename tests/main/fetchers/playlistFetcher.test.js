import { describe, it, expect, vi } from 'vitest'
import {
  createPlaylistFetcher,
  PlaylistFetchError
} from '../../../src/main/fetchers/playlistFetcher'

function makeFetcher(client, logger = null) {
  return createPlaylistFetcher({
    ytFactory: () => client,
    timeoutMs: 50,
    logger
  })
}

describe('PlaylistFetcher', () => {
  it('lists the first page of my playlists', async () => {
    const client = {
      playlists: {
        list: vi.fn().mockResolvedValue({
          data: {
            items: [
              { id: 'PL1', snippet: { title: 'One' }, contentDetails: { itemCount: 3 } },
              { id: 'PL2', snippet: { title: 'Two' }, contentDetails: { itemCount: 0 } }
            ]
          }
        })
      }
    }
    const result = await makeFetcher(client).listMyPlaylists({})
    expect(client.playlists.list).toHaveBeenCalledWith({
      part: ['snippet', 'contentDetails'],
      mine: true,
      maxResults: 50
    })
    expect(result).toEqual([
      { id: 'PL1', title: 'One', itemCount: 3 },
      { id: 'PL2', title: 'Two', itemCount: 0 }
    ])
  })

  it('logs when my playlist list is truncated after 50 items', async () => {
    const logger = { warn: vi.fn() }
    const client = {
      playlists: {
        list: vi.fn().mockResolvedValue({ data: { items: [], nextPageToken: 'NEXT' } })
      }
    }
    await makeFetcher(client, logger).listMyPlaylists({})
    expect(logger.warn).toHaveBeenCalledWith('playlistFetcher.listMyPlaylists.truncated', {
      maxResults: 50
    })
  })

  it('fetches all playlist item pages', async () => {
    const client = {
      playlistItems: {
        list: vi
          .fn()
          .mockResolvedValueOnce({
            data: {
              nextPageToken: 'P2',
              items: [
                {
                  snippet: { title: 'One', resourceId: { videoId: 'V1' } },
                  contentDetails: { videoId: 'V1' }
                }
              ]
            }
          })
          .mockResolvedValueOnce({
            data: {
              items: [
                {
                  snippet: { title: 'Two', resourceId: { videoId: 'V2' } },
                  contentDetails: { videoId: 'V2' }
                }
              ]
            }
          })
      }
    }
    const result = await makeFetcher(client).fetchPlaylistItems({}, 'PL1')
    expect(client.playlistItems.list).toHaveBeenCalledTimes(2)
    expect(client.playlistItems.list.mock.calls[0][0]).toMatchObject({
      part: ['snippet', 'contentDetails'],
      playlistId: 'PL1',
      maxResults: 50,
      pageToken: undefined
    })
    expect(client.playlistItems.list.mock.calls[1][0].pageToken).toBe('P2')
    expect(result.map((item) => item.videoId)).toEqual(['V1', 'V2'])
  })

  it('throws identifiable quota and playlist-not-found errors', async () => {
    const quotaClient = {
      playlistItems: {
        list: vi.fn().mockRejectedValue({ code: 403, errors: [{ reason: 'quotaExceeded' }] })
      }
    }
    await expect(makeFetcher(quotaClient).fetchPlaylistItems({}, 'PL1')).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED'
    })

    const missingClient = {
      playlistItems: {
        list: vi.fn().mockRejectedValue({ code: 404 })
      }
    }
    await expect(makeFetcher(missingClient).fetchPlaylistItems({}, 'PL1')).rejects.toMatchObject({
      code: 'PLAYLIST_NOT_FOUND'
    })
  })

  it('requires an authenticated client', async () => {
    await expect(makeFetcher({}).listMyPlaylists(null)).rejects.toBeInstanceOf(PlaylistFetchError)
    await expect(makeFetcher({}).listMyPlaylists(null)).rejects.toMatchObject({
      code: 'NOT_AUTHENTICATED'
    })
  })
})
