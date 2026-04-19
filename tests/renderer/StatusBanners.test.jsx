import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import StatusBanners from '../../src/renderer/components/StatusBanners'

beforeEach(() => {
  window.api = {
    getRssFailureRate: vi.fn().mockResolvedValue(0),
    resetDatabase: vi.fn()
  }
})

describe('StatusBanners', () => {
  it('shows DB broken banner when dbBroken=true', async () => {
    render(<StatusBanners dbBroken={true} isOffline={false} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('データベースが破損')
  })

  it('shows offline banner when isOffline=true', async () => {
    render(<StatusBanners dbBroken={false} isOffline={true} />)
    expect(await screen.findByText(/オフラインです/)).toBeInTheDocument()
  })

  it('shows RSS failure banner when failure rate > 80%', async () => {
    window.api.getRssFailureRate = vi.fn().mockResolvedValue(0.9)
    render(<StatusBanners dbBroken={false} isOffline={false} />)
    await waitFor(() =>
      expect(screen.getByText(/RSS 取得失敗率が高くなっています/)).toBeInTheDocument()
    )
  })

  it('hides RSS banner when failure rate is normal', async () => {
    render(<StatusBanners dbBroken={false} isOffline={false} />)
    await waitFor(() => {
      expect(screen.queryByText(/RSS 取得失敗率が高くなっています/)).not.toBeInTheDocument()
    })
  })
})
