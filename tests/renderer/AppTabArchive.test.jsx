import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AppTabArchive from '../../src/renderer/components/AppTabArchive.jsx'

const cardCtx = {
  darkMode: false,
  pinnedChannelIds: new Set(),
  onToggleWatch: vi.fn(),
  onToggleFavorite: vi.fn(),
  onMarkViewed: vi.fn(),
  onTogglePin: vi.fn(),
  onFilterChannel: vi.fn(),
  isChannelFiltered: vi.fn().mockReturnValue(false)
}

function renderArchive(props = {}) {
  return render(
    <AppTabArchive
      filteredArchive={[]}
      tabLoading={false}
      archiveHasMore={false}
      archiveLoadingMore={false}
      archiveSentinelRef={createRef()}
      archiveHasActiveFilters={false}
      searchQuery=""
      subColor="#6060a0"
      cardCtx={cardCtx}
      {...props}
    />
  )
}

describe('AppTabArchive', () => {
  it('tabLoading=true のとき読み込み中を表示する', () => {
    renderArchive({ tabLoading: true })

    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('filteredArchive=[] かつ active filters ありなら条件不一致を表示する', () => {
    renderArchive({ archiveHasActiveFilters: true })

    expect(screen.getByText('条件に一致するアーカイブはありません')).toBeInTheDocument()
  })

  it('filteredArchive=[] かつ検索もフィルタもなければアーカイブなしを表示する', () => {
    renderArchive()

    expect(screen.getByText('アーカイブがありません')).toBeInTheDocument()
  })
})
