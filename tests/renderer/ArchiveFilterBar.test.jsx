import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ArchiveFilterBar } from '../../src/renderer/components/ArchiveFilterBar.jsx'

const baseFilters = {
  channelIds: [],
  videoType: 'all',
  period: 'all',
  customStart: null,
  customEnd: null
}

function setup(overrides = {}) {
  const onChangeFilters = vi.fn()
  const onChangeSort = vi.fn()
  render(
    <ArchiveFilterBar
      channels={[
        { id: 'c1', title: 'Channel One' },
        { id: 'c2', title: 'Channel Two' }
      ]}
      filters={baseFilters}
      sort="newest"
      onChangeFilters={onChangeFilters}
      onChangeSort={onChangeSort}
      {...overrides}
    />
  )
  return { onChangeFilters, onChangeSort }
}

describe('ArchiveFilterBar', () => {
  it('is collapsed by default (filter controls hidden)', () => {
    setup()
    expect(screen.queryByLabelText('配信タイプ')).not.toBeInTheDocument()
  })

  it('expands when the toggle button is clicked', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /絞り込み/ }))
    expect(screen.getByLabelText('配信タイプ')).toBeInTheDocument()
  })

  it('shows active filter count badge', () => {
    setup({ filters: { ...baseFilters, videoType: 'live-done', period: '30d' } })
    expect(screen.getByRole('button', { name: /絞り込み/ })).toHaveTextContent('2')
  })

  it('calls onChangeSort when sort select changes', () => {
    const { onChangeSort } = setup()
    fireEvent.click(screen.getByRole('button', { name: /絞り込み/ }))
    fireEvent.change(screen.getByLabelText('並び替え'), { target: { value: 'duration' } })
    expect(onChangeSort).toHaveBeenCalledWith('duration')
  })

  it('calls onChangeFilters when video type changes', () => {
    const { onChangeFilters } = setup()
    fireEvent.click(screen.getByRole('button', { name: /絞り込み/ }))
    fireEvent.change(screen.getByLabelText('配信タイプ'), { target: { value: 'didnt-air' } })
    expect(onChangeFilters).toHaveBeenCalledWith(
      expect.objectContaining({ videoType: 'didnt-air' })
    )
  })
})
