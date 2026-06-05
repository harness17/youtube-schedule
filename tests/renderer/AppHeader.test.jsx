import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import AppHeader from '../../src/renderer/components/AppHeader.jsx'

function renderHeader(props = {}) {
  const onRefresh = vi.fn()
  const onOpenSettings = vi.fn()

  render(
    <AppHeader
      appVersion="1.23.0"
      isAuthenticated={true}
      loading={false}
      textColor="#111120"
      subColor="#6060a0"
      onRefresh={onRefresh}
      onOpenSettings={onOpenSettings}
      {...props}
    />
  )

  return { onRefresh, onOpenSettings }
}

describe('AppHeader', () => {
  it('ブランド名・バージョン・フルモード表示を描画する', () => {
    renderHeader()

    expect(screen.getByRole('heading', { name: /Youtom/ })).toBeInTheDocument()
    expect(screen.getByText('v1.23.0')).toBeInTheDocument()
    expect(screen.getByText('YouTube 配信予定ビューア')).toBeInTheDocument()
    expect(screen.getByText('フルモード')).toBeInTheDocument()
  })

  it('簡易モードクリックで接続設定を開く', () => {
    const { onOpenSettings } = renderHeader({ isAuthenticated: false })

    fireEvent.click(screen.getByText('簡易モード'))

    expect(onOpenSettings).toHaveBeenCalledWith('connection')
  })

  it('更新ボタンクリックで onRefresh を呼ぶ', () => {
    const { onRefresh } = renderHeader()

    fireEvent.click(screen.getByRole('button', { name: '↺ 更新' }))

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('loading=true のとき更新ボタンを無効化する', () => {
    renderHeader({ loading: true })

    expect(screen.getByRole('button', { name: '更新中...' })).toBeDisabled()
  })

  it('設定ボタンクリックで表示設定を開く', () => {
    const { onOpenSettings } = renderHeader()

    fireEvent.click(screen.getByTitle('設定'))

    expect(onOpenSettings).toHaveBeenCalledWith('display')
  })
})
