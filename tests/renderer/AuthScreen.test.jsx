import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AuthScreen from '../../src/renderer/components/AuthScreen.jsx'

describe('AuthScreen', () => {
  it('Google でログインボタンが表示される', () => {
    render(<AuthScreen onLogin={vi.fn()} loading={false} />)
    expect(screen.getByText('Google でログイン')).toBeInTheDocument()
  })

  it('ボタンクリックで onLogin が呼ばれる', () => {
    const onLogin = vi.fn()
    render(<AuthScreen onLogin={onLogin} loading={false} />)
    fireEvent.click(screen.getByText('Google でログイン'))
    expect(onLogin).toHaveBeenCalledTimes(1)
  })

  it('loading=true のときボタンが無効になり「認証中...」と表示される', () => {
    render(<AuthScreen onLogin={vi.fn()} loading={true} />)
    expect(screen.getByText('認証中...')).toBeDisabled()
  })
})
