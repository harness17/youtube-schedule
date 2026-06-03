import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SettingsTabData from '../../src/renderer/components/SettingsTabData.jsx'

const styles = {
  textColor: '#111120',
  rowStyle: {},
  btnStyle: () => ({}),
  descStyle: {},
  sectionLabelStyle: {}
}

function renderData(overrides = {}) {
  return render(
    <SettingsTabData
      styles={styles}
      onExportSettings={vi.fn()}
      onImportSettings={vi.fn()}
      onExportFavorites={vi.fn()}
      onImportFavorites={vi.fn()}
      onResetDatabase={vi.fn()}
      {...overrides}
    />
  )
}

describe('SettingsTabData', () => {
  it('設定のエクスポート / インポートセクションが表示される', () => {
    renderData()
    expect(screen.getByText('設定のエクスポート / インポート')).toBeInTheDocument()
    expect(screen.getByText('アプリ設定を JSON で保存・読み込み')).toBeInTheDocument()
  })

  it('エクスポートボタンクリックで onExportSettings が呼ばれる', () => {
    const onExportSettings = vi.fn()
    renderData({ onExportSettings })

    fireEvent.click(screen.getAllByRole('button', { name: '⬇ エクスポート' })[0])

    expect(onExportSettings).toHaveBeenCalledTimes(1)
  })

  it('リセットボタンクリックで onResetDatabase が呼ばれる', () => {
    const onResetDatabase = vi.fn()
    renderData({ onResetDatabase })

    fireEvent.click(screen.getByRole('button', { name: '🗑 リセット' }))

    expect(onResetDatabase).toHaveBeenCalledTimes(1)
  })
})
