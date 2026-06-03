import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SettingsTabChannels from '../../src/renderer/components/SettingsTabChannels.jsx'

const styles = {
  textColor: '#111120',
  subColor: '#6060a0',
  bgColor: '#ffffff',
  inputBg: '#f4f4fb',
  inputBorder: '#dddde8',
  subBtnBg: '#ebebf5',
  subBtnColor: '#555570',
  rowStyle: {},
  btnStyle: () => ({}),
  descStyle: {},
  sectionLabelStyle: {}
}

function renderChannels(overrides = {}) {
  return render(
    <SettingsTabChannels
      darkMode={false}
      channels={[]}
      channelManagerQuery=""
      manualChannelInput=""
      manualChannelTitle=""
      manualChannelSaving={false}
      manualVideoInput=""
      manualVideoSaving={false}
      manualVideoMessage={null}
      isAuthenticated={false}
      isSyncingChannels={false}
      styles={styles}
      onChannelManagerQueryChange={vi.fn()}
      onManualChannelInputChange={vi.fn()}
      onManualChannelTitleChange={vi.fn()}
      onManualVideoInputChange={vi.fn()}
      onAddManualChannel={vi.fn()}
      onAddManualVideo={vi.fn()}
      onTogglePin={vi.fn()}
      onDeleteChannel={vi.fn()}
      {...overrides}
    />
  )
}

describe('SettingsTabChannels', () => {
  it('優先チャンネル相当のセクションが表示される', () => {
    renderChannels()
    expect(screen.getByText('優先チャンネル')).toBeInTheDocument()
    expect(screen.getByText('予定・ライブ一覧の上部に表示するチャンネルを管理')).toBeInTheDocument()
  })

  it('channels=[] のとき空状態テキストが表示される', () => {
    renderChannels()
    expect(screen.getByText('該当するチャンネルがありません')).toBeInTheDocument()
    expect(screen.getByText('手動追加したチャンネルはまだありません')).toBeInTheDocument()
  })

  it('手動追加ボタンクリックで onAddManualChannel が呼ばれる', () => {
    const onAddManualChannel = vi.fn()
    renderChannels({ onAddManualChannel })

    fireEvent.click(screen.getAllByRole('button', { name: '追加' })[1])

    expect(onAddManualChannel).toHaveBeenCalledTimes(1)
  })
})
