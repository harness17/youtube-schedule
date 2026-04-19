import { describe, it, expect, vi } from 'vitest'
import { createSubscriptionsFetcher } from '../../../src/main/fetchers/subscriptionsFetcher'

function makeYt(pages) {
  return {
    subscriptions: {
      list: vi.fn().mockImplementation(async ({ pageToken }) => {
        const index = pageToken ? parseInt(pageToken, 10) : 0
        return { data: pages[index] }
      })
    }
  }
}

describe('SubscriptionsFetcher', () => {
  it('returns channels from a single page', async () => {
    const yt = makeYt([
      {
        items: [
          { snippet: { title: 'A', resourceId: { channelId: 'UCA' } } },
          { snippet: { title: 'B', resourceId: { channelId: 'UCB' } } }
        ],
        nextPageToken: undefined
      }
    ])
    const fetcher = createSubscriptionsFetcher()
    const channels = await fetcher.fetch(yt)
    expect(channels).toEqual([
      { id: 'UCA', title: 'A', uploadsPlaylistId: 'UUA' },
      { id: 'UCB', title: 'B', uploadsPlaylistId: 'UUB' }
    ])
  })

  it('paginates until nextPageToken is undefined', async () => {
    const yt = makeYt([
      {
        items: [{ snippet: { title: 'A', resourceId: { channelId: 'UCA' } } }],
        nextPageToken: '1'
      },
      {
        items: [{ snippet: { title: 'B', resourceId: { channelId: 'UCB' } } }],
        nextPageToken: undefined
      }
    ])
    const fetcher = createSubscriptionsFetcher()
    const channels = await fetcher.fetch(yt)
    expect(channels.map((c) => c.id)).toEqual(['UCA', 'UCB'])
    expect(yt.subscriptions.list).toHaveBeenCalledTimes(2)
  })
})
