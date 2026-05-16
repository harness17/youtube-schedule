import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ArchiveFilterBar } from '../../src/renderer/components/ArchiveFilterBar.jsx'

const baseFilters = {
  channelIds: [],
  period: 'all',
  customStart: null,
  customEnd: null
}

function setup(overrides = {}) {
  const onChangeFilters = vi.fn()
  const onChangeSort = vi.fn()
  const onReset = vi.fn()
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
      onReset={onReset}
      {...overrides}
    />
  )
  return { onChangeFilters, onChangeSort, onReset }
}

describe('ArchiveFilterBar', () => {
  it('is collapsed by default (filter controls hidden)', () => {
    setup()
    expect(screen.queryByLabelText('並び替え')).not.toBeInTheDocument()
  })

  it('expands when the toggle button is clicked', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /絞り込み/ }))
    expect(screen.getByLabelText('並び替え')).toBeInTheDocument()
  })

  it('shows active filter count badge', () => {
    setup({ filters: { ...baseFilters, channelIds: ['c1'], period: '30d' } })
    expect(screen.getByRole('button', { name: /絞り込み/ })).toHaveTextContent('2')
  })

  it('calls onChangeSort when sort select changes', () => {
    const { onChangeSort } = setup()
    fireEvent.click(screen.getByRole('button', { name: /絞り込み/ }))
    fireEvent.change(screen.getByLabelText('並び替え'), { target: { value: 'duration' } })
    expect(onChangeSort).toHaveBeenCalledWith('duration')
  })

  it('opens and closes the channel popover', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /絞り込み/ }))
    const channelButton = screen.getByRole('button', { name: 'チャンネル' })

    fireEvent.click(channelButton)
    expect(screen.getByLabelText('チャンネル検索')).toBeInTheDocument()

    fireEvent.click(channelButton)
    expect(screen.queryByLabelText('チャンネル検索')).not.toBeInTheDocument()
  })

  it('closes the channel popover on outside click', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /絞り込み/ }))
    fireEvent.click(screen.getByRole('button', { name: 'チャンネル' }))
    expect(screen.getByLabelText('チャンネル検索')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByLabelText('チャンネル検索')).not.toBeInTheDocument()
  })

  it('filters channels in the popover by search text', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /絞り込み/ }))
    fireEvent.click(screen.getByRole('button', { name: 'チャンネル' }))

    fireEvent.change(screen.getByLabelText('チャンネル検索'), { target: { value: 'Two' } })

    expect(screen.queryByLabelText('Channel One')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Channel Two')).toBeInTheDocument()
  })

  it('calls onChangeFilters when a channel is selected', () => {
    const { onChangeFilters } = setup()
    fireEvent.click(screen.getByRole('button', { name: /絞り込み/ }))
    fireEvent.click(screen.getByRole('button', { name: 'チャンネル' }))
    fireEvent.click(screen.getByLabelText('Channel One'))

    expect(onChangeFilters).toHaveBeenCalledWith(expect.objectContaining({ channelIds: ['c1'] }))
  })

  it('shows selected channel chips and removes them', () => {
    const { onChangeFilters } = setup({ filters: { ...baseFilters, channelIds: ['c1'] } })
    fireEvent.click(screen.getByRole('button', { name: /絞り込み/ }))

    expect(screen.getByText('Channel One')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Channel One を解除' }))

    expect(onChangeFilters).toHaveBeenCalledWith(expect.objectContaining({ channelIds: [] }))
  })

  it('hides the reset button when filters and sort are at defaults', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'リセット' })).not.toBeInTheDocument()
  })

  it('shows the reset button when a filter is active and calls onReset', () => {
    const { onReset } = setup({ filters: { ...baseFilters, period: '30d' } })
    const resetButton = screen.getByRole('button', { name: 'リセット' })
    fireEvent.click(resetButton)
    expect(onReset).toHaveBeenCalled()
  })

  it('shows the reset button when sort is not the default', () => {
    setup({ sort: 'duration' })
    expect(screen.getByRole('button', { name: 'リセット' })).toBeInTheDocument()
  })
})
