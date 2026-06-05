import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SettingsTabAbout from '../../src/renderer/components/SettingsTabAbout.jsx'

const styles = {
  textColor: '#111120',
  subColor: '#6060a0',
  rowStyle: {},
  btnStyle: () => ({}),
  descStyle: {},
  sectionLabelStyle: {}
}

function renderAbout(overrides = {}) {
  return render(
    <SettingsTabAbout
      darkMode={false}
      appVersion="1.22.1"
      autoDownload={true}
      updateChecking={false}
      styles={styles}
      onCheckUpdate={vi.fn()}
      onAutoDownloadToggle={vi.fn()}
      onOpenExternal={vi.fn()}
      {...overrides}
    />
  )
}

describe('SettingsTabAbout', () => {
  it('appVersion prop が描画に含まれる', () => {
    renderAbout()
    expect(screen.getByText(/現在: v1\.22\.1/)).toBeInTheDocument()
    expect(screen.getByText('v1.22.1')).toBeInTheDocument()
  })

  it('GitHub ボタンクリックで onOpenExternal が呼ばれる', () => {
    const onOpenExternal = vi.fn()
    renderAbout({ onOpenExternal })

    fireEvent.click(screen.getByRole('button', { name: 'GitHub ↗' }))

    expect(onOpenExternal).toHaveBeenCalledWith('https://github.com/harness17/youtube-schedule')
  })
})
