import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createLogger } from '../../src/main/logger.js'

function readLines(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l))
}

describe('logger', () => {
  let logsDir

  beforeEach(() => {
    logsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-logger-'))
  })

  afterEach(() => {
    fs.rmSync(logsDir, { recursive: true, force: true })
  })

  it('書き込み先ディレクトリを作成する', () => {
    const nested = path.join(logsDir, 'nested', 'a')
    createLogger({ logsDir: nested })
    expect(fs.existsSync(nested)).toBe(true)
  })

  it('info/warn/error を JSON Lines で日次ファイルに追記する', () => {
    const fixedNow = new Date('2026-05-10T12:34:56Z')
    const logger = createLogger({ logsDir, now: () => fixedNow })
    logger.info('phase.a', { count: 3 })
    logger.warn('phase.b', { reason: 'timeout' })
    logger.error('phase.c', { error: new Error('boom') })

    const file = path.join(logsDir, 'app-2026-05-10.log')
    expect(fs.existsSync(file)).toBe(true)

    const lines = readLines(file)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toMatchObject({ level: 'info', phase: 'phase.a', count: 3 })
    expect(lines[1]).toMatchObject({ level: 'warn', phase: 'phase.b', reason: 'timeout' })
    expect(lines[2].level).toBe('error')
    expect(lines[2].error).toMatchObject({ name: 'Error', message: 'boom' })
    expect(typeof lines[2].error.stack).toBe('string')
  })

  it('withTiming は start/done を durationMs 付きで記録する', async () => {
    const fixedNow = new Date('2026-05-10T00:00:00Z')
    const logger = createLogger({ logsDir, now: () => fixedNow })
    const result = await logger.withTiming('phase.x', async () => 'ok', { extra: 1 })
    expect(result).toBe('ok')

    const lines = readLines(path.join(logsDir, 'app-2026-05-10.log'))
    expect(lines.map((l) => l.phase)).toEqual(['phase.x.start', 'phase.x.done'])
    expect(lines[0].extra).toBe(1)
    expect(typeof lines[1].durationMs).toBe('number')
  })

  it('withTiming は例外時に error を記録して再スローする', async () => {
    const fixedNow = new Date('2026-05-10T00:00:00Z')
    const logger = createLogger({ logsDir, now: () => fixedNow })
    await expect(
      logger.withTiming('phase.err', async () => {
        throw new Error('nope')
      })
    ).rejects.toThrow('nope')

    const lines = readLines(path.join(logsDir, 'app-2026-05-10.log'))
    expect(lines.map((l) => l.phase)).toEqual(['phase.err.start', 'phase.err.error'])
    expect(lines[1].error.message).toBe('nope')
  })

  it('cleanupOldLogs は保持日数より古いログのみ削除する', () => {
    // 固定の「現在」= 2026-05-10
    const fixedNow = new Date('2026-05-10T00:00:00Z')
    // 事前に古いログと新しいログを配置
    fs.writeFileSync(path.join(logsDir, 'app-2026-04-01.log'), '{}\n')
    fs.writeFileSync(path.join(logsDir, 'app-2026-05-09.log'), '{}\n')
    fs.writeFileSync(path.join(logsDir, 'unrelated.txt'), 'keep')

    const logger = createLogger({ logsDir, now: () => fixedNow, retentionDays: 7 })
    logger.cleanupOldLogs()

    expect(fs.existsSync(path.join(logsDir, 'app-2026-04-01.log'))).toBe(false)
    expect(fs.existsSync(path.join(logsDir, 'app-2026-05-09.log'))).toBe(true)
    expect(fs.existsSync(path.join(logsDir, 'unrelated.txt'))).toBe(true)
  })
})
