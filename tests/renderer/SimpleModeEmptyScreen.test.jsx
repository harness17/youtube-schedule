import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SimpleModeEmptyScreen from '../../src/renderer/components/SimpleModeEmptyScreen.jsx'

describe('SimpleModeEmptyScreen', () => {
  it('見出しと説明文が表示される', () => {
    render(<SimpleModeEmptyScreen onOpenSettings={vi.fn()} />)
    expect(screen.getByText('チャンネルを追加しよう')).toBeInTheDocument()
    expect(screen.getByText('登録チャンネルの新着動画がここに表示されます')).toBeInTheDocument()
  })

  it('ボタンクリックで onOpenSettings が呼ばれる', () => {
    const onOpenSettings = vi.fn()
    render(<SimpleModeEmptyScreen onOpenSettings={onOpenSettings} />)
    fireEvent.click(screen.getByText(/チャンネルを追加する/))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })
})
