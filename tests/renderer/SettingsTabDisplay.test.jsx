import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SettingsTabDisplay from '../../src/renderer/components/SettingsTabDisplay.jsx'

const styles = {
  textColor: '#111120',
  subColor: '#6060a0',
  bgColor: '#ffffff',
  inputBorder: '#dddde8',
  sectionLabelStyle: {},
  rowStyle: {},
  descStyle: {}
}

function renderDisplay(overrides = {}) {
  return render(
    <SettingsTabDisplay
      darkMode={false}
      reminderMinutes={10}
      hideMembershipVideos={false}
      styles={styles}
      onDarkModeChange={vi.fn()}
      onReminderMinutesChange={vi.fn()}
      onHideMembershipVideosChange={vi.fn()}
      {...overrides}
    />
  )
}

describe('SettingsTabDisplay', () => {
  it('ダークモードトグルボタンが表示される', () => {
    renderDisplay()
    expect(screen.getByText('ダークモード')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'OFF' })).toHaveLength(2)
  })

  it('リマインダー分数 input が表示される', () => {
    renderDisplay()
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()
  })

  it('ダークモードボタンクリックで onDarkModeChange が呼ばれる', () => {
    const onDarkModeChange = vi.fn()
    renderDisplay({ onDarkModeChange })

    fireEvent.click(screen.getAllByRole('button', { name: 'OFF' })[0])

    expect(onDarkModeChange).toHaveBeenCalledWith(true)
  })
})
