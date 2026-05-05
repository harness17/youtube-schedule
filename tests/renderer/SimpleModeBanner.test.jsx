import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SimpleModeBanner from '../../src/renderer/components/SimpleModeBanner.jsx'

describe('SimpleModeBanner', () => {
  it('誘導テキストが表示される', () => {
    render(<SimpleModeBanner onOpenSettings={vi.fn()} />)
    expect(screen.getByText(/配信予定時刻・ライブ検出はフルモードで/)).toBeInTheDocument()
  })

  it('「有効にする」クリックで onOpenSettings が呼ばれる', () => {
    const onOpenSettings = vi.fn()
    render(<SimpleModeBanner onOpenSettings={onOpenSettings} />)
    fireEvent.click(screen.getByText(/有効にする/))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })
})
