import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SettingsTabConnection from '../../src/renderer/components/SettingsTabConnection.jsx'

const styles = {
  textColor: '#111120',
  subColor: '#6060a0',
  inputBorder: '#dddde8',
  subBtnBg: '#ebebf5',
  rowStyle: {},
  btnStyle: () => ({}),
  descStyle: {},
  sectionLabelStyle: {}
}

function renderConnection(overrides = {}) {
  return render(
    <SettingsTabConnection
      darkMode={false}
      isAuthenticated={false}
      credentialsMissing={true}
      credentialsPath={null}
      authError={null}
      styles={styles}
      onImportCredentials={vi.fn()}
      onLogin={vi.fn()}
      onLogout={vi.fn()}
      onOpenExternal={vi.fn()}
      {...overrides}
    />
  )
}

describe('SettingsTabConnection', () => {
  it('動作モード相当のテキストが表示される', () => {
    renderConnection()
    expect(screen.getByText('動作モード')).toBeInTheDocument()
    expect(screen.getByText('簡易モードで動作中')).toBeInTheDocument()
  })

  it('isAuthenticated=true のときフルモード相当のテキストが表示される', () => {
    renderConnection({ isAuthenticated: true, credentialsMissing: false })
    expect(screen.getByText('フルモードで動作中')).toBeInTheDocument()
    expect(screen.getByText('● Google連携: 認証済み')).toBeInTheDocument()
  })

  it('credentials.json 読み込みボタンクリックで onImportCredentials が呼ばれる', () => {
    const onImportCredentials = vi.fn()
    renderConnection({ onImportCredentials })

    fireEvent.click(screen.getByRole('button', { name: 'credentials.json を読み込み' }))

    expect(onImportCredentials).toHaveBeenCalledTimes(1)
  })
})
