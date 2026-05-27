import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

const { handlers, ipcMainHandle, showSaveDialog, showOpenDialog, getSetting, setSetting } =
  vi.hoisted(() => {
    const handlers = new Map()
    return {
      handlers,
      ipcMainHandle: vi.fn((channel, handler) => handlers.set(channel, handler)),
      showSaveDialog: vi.fn(),
      showOpenDialog: vi.fn(),
      getSetting: vi.fn(),
      setSetting: vi.fn()
    }
  })

vi.mock('electron', () => ({
  ipcMain: { handle: ipcMainHandle },
  dialog: { showSaveDialog, showOpenDialog }
}))

vi.mock('../../../src/main/store.js', () => ({
  getSetting,
  setSetting
}))

const { registerSettingsHandlers } = await import('../../../src/main/ipc/settingsHandlers')

function invoke(channel, ...args) {
  return handlers.get(channel)({}, ...args)
}

describe('settingsHandlers', () => {
  let tempDir
  let mainWindow
  let videoRepo
  let channelRepo

  beforeEach(async () => {
    handlers.clear()
    ipcMainHandle.mockClear()
    showSaveDialog.mockReset()
    showOpenDialog.mockReset()
    getSetting.mockReset()
    setSetting.mockReset()
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'youtom-settings-ipc-'))
    mainWindow = { id: 1 }
    videoRepo = {
      listFavorites: vi
        .fn()
        .mockReturnValue([
          { id: 'v1', title: 'Video', channelId: 'UC1', channelTitle: 'Channel', viewedAt: null }
        ]),
      importAsFavorite: vi.fn().mockReturnValue(true)
    }
    channelRepo = {
      listAll: vi.fn().mockReturnValue([
        { id: 'UC1', title: 'Pinned', isPinned: true },
        { id: 'UC2', title: 'Other', isPinned: false }
      ]),
      replacePinnedChannels: vi.fn()
    }
    getSetting.mockImplementation((key, defaultValue) => (key === 'darkMode' ? true : defaultValue))
    setSetting.mockReturnValue(true)
    registerSettingsHandlers({
      getVideoRepo: () => videoRepo,
      getChannelRepo: () => channelRepo,
      getMainWindow: () => mainWindow
    })
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('registers settings and favorites IPC channels', () => {
    expect([...handlers.keys()].sort()).toEqual([
      'favorites:export',
      'favorites:import',
      'settings:export',
      'settings:get',
      'settings:import',
      'settings:set'
    ])
  })

  it('settings:get reads a setting through the store wrapper', () => {
    expect(invoke('settings:get', 'darkMode', false)).toBe(true)
    expect(getSetting).toHaveBeenCalledWith('darkMode', false)
  })

  it('settings:set writes a setting through the store wrapper', () => {
    expect(invoke('settings:set', 'darkMode', false)).toBe(true)
    expect(setSetting).toHaveBeenCalledWith('darkMode', false)
  })

  it('settings:export writes darkMode and pinned channels to the chosen file', async () => {
    const filePath = path.join(tempDir, 'settings.json')
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await expect(invoke('settings:export')).resolves.toEqual({ success: true })
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'))
    expect(data.settings).toEqual({ darkMode: true })
    expect(data.pinnedChannels).toEqual([{ id: 'UC1', title: 'Pinned' }])
    expect(showSaveDialog).toHaveBeenCalledWith(
      mainWindow,
      expect.objectContaining({ defaultPath: expect.stringMatching(/^settings-export-/) })
    )
  })

  it('settings:export returns canceled when the user cancels the save dialog', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true })

    await expect(invoke('settings:export')).resolves.toEqual({ canceled: true })
  })

  it('settings:import applies darkMode and pinned channels from a valid file', async () => {
    const filePath = path.join(tempDir, 'settings-import.json')
    await fs.writeFile(
      filePath,
      JSON.stringify({
        version: 1,
        settings: { darkMode: false },
        pinnedChannels: [{ id: 'UC3', title: 'Imported' }]
      }),
      'utf-8'
    )
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] })

    await expect(invoke('settings:import')).resolves.toEqual({
      success: true,
      darkMode: false,
      pinnedChannels: [{ id: 'UC3', title: 'Imported' }]
    })
    expect(setSetting).toHaveBeenCalledWith('darkMode', false)
    expect(channelRepo.replacePinnedChannels).toHaveBeenCalledWith([
      { id: 'UC3', title: 'Imported' }
    ])
  })

  it('settings:import filters invalid pinned channel entries before replacing pins', async () => {
    const filePath = path.join(tempDir, 'settings-import-filter.json')
    await fs.writeFile(
      filePath,
      JSON.stringify({
        version: 1,
        pinnedChannels: [{ id: 'UC3' }, { id: '' }, null]
      }),
      'utf-8'
    )
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] })

    await expect(invoke('settings:import')).resolves.toMatchObject({ success: true })
    expect(channelRepo.replacePinnedChannels).toHaveBeenCalledWith([{ id: 'UC3' }])
  })

  it('settings:import returns canceled when no file is selected', async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })

    await expect(invoke('settings:import')).resolves.toEqual({ canceled: true })
  })

  it('settings:import returns validation errors for invalid data', async () => {
    const filePath = path.join(tempDir, 'invalid-settings.json')
    await fs.writeFile(filePath, JSON.stringify({ version: 1, favorites: [] }), 'utf-8')
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] })

    await expect(invoke('settings:import')).resolves.toEqual({
      error: 'このファイルはお気に入りのエクスポートです。設定インポートには使用できません'
    })
  })

  it('favorites:export writes favorites to the chosen file', async () => {
    const filePath = path.join(tempDir, 'favorites.json')
    showSaveDialog.mockResolvedValue({ canceled: false, filePath })

    await expect(invoke('favorites:export')).resolves.toEqual({ success: true, count: 1 })
    const data = JSON.parse(await fs.readFile(filePath, 'utf-8'))
    expect(data.favorites).toEqual([
      { id: 'v1', title: 'Video', channelId: 'UC1', channelTitle: 'Channel', viewedAt: null }
    ])
  })

  it('favorites:export returns canceled when the user cancels the save dialog', async () => {
    showSaveDialog.mockResolvedValue({ canceled: true })

    await expect(invoke('favorites:export')).resolves.toEqual({ canceled: true })
  })

  it('favorites:import applies valid favorites through the video repository', async () => {
    const filePath = path.join(tempDir, 'favorites-import.json')
    await fs.writeFile(
      filePath,
      JSON.stringify({
        version: 1,
        favorites: [
          { id: 'v1', title: 'Video', channelId: 'UC1', channelTitle: 'Channel', viewedAt: null },
          { id: 'v2', title: 'Video 2', channelId: 'UC2', channelTitle: 'Channel 2' }
        ]
      }),
      'utf-8'
    )
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] })

    await expect(invoke('favorites:import')).resolves.toEqual({
      success: true,
      applied: 2,
      skipped: 0
    })
    expect(videoRepo.importAsFavorite).toHaveBeenCalledTimes(2)
  })

  it('favorites:import returns NOT_INITIALIZED without a video repository', async () => {
    registerSettingsHandlers({
      getVideoRepo: () => null,
      getChannelRepo: () => channelRepo,
      getMainWindow: () => mainWindow
    })
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['unused.json'] })

    await expect(invoke('favorites:import')).resolves.toEqual({ error: 'NOT_INITIALIZED' })
  })

  it('favorites:import returns canceled when no file is selected', async () => {
    showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })

    await expect(invoke('favorites:import')).resolves.toEqual({ canceled: true })
  })

  it('favorites:import returns validation errors for invalid data', async () => {
    const filePath = path.join(tempDir, 'invalid-favorites.json')
    await fs.writeFile(
      filePath,
      JSON.stringify({ version: 1, settings: {}, pinnedChannels: [] }),
      'utf-8'
    )
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] })

    await expect(invoke('favorites:import')).resolves.toEqual({
      error: 'このファイルは設定のエクスポートです。お気に入りインポートには使用できません'
    })
  })
})
