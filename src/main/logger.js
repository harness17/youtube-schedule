import fs from 'node:fs'
import path from 'node:path'

const LEVELS = ['debug', 'info', 'warn', 'error']
const RETENTION_DAYS = 7

function pad2(n) {
  return String(n).padStart(2, '0')
}

function dateStamp(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function safeJsonStringify(obj) {
  try {
    return JSON.stringify(obj)
  } catch {
    const seen = new WeakSet()
    return JSON.stringify(obj, (_k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[Circular]'
        seen.add(v)
      }
      return v
    })
  }
}

function serializeError(err) {
  if (!err) return null
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code
    }
  }
  return { message: String(err) }
}

export function createLogger({
  logsDir,
  now = () => new Date(),
  retentionDays = RETENTION_DAYS
} = {}) {
  if (!logsDir) throw new Error('logsDir is required')

  fs.mkdirSync(logsDir, { recursive: true })

  function currentLogPath() {
    return path.join(logsDir, `app-${dateStamp(now())}.log`)
  }

  function writeLine(level, phase, fields) {
    const record = {
      ts: now().toISOString(),
      level,
      phase,
      ...fields
    }
    if (record.error) record.error = serializeError(record.error)
    const line = safeJsonStringify(record) + '\n'
    try {
      fs.appendFileSync(currentLogPath(), line, 'utf8')
    } catch {
      // ログ書き込み失敗は握りつぶす（ログがアプリ停止要因にならないように）
    }
  }

  function cleanupOldLogs() {
    try {
      const files = fs.readdirSync(logsDir)
      const cutoff = now().getTime() - retentionDays * 24 * 60 * 60 * 1000
      for (const f of files) {
        const m = /^app-(\d{4}-\d{2}-\d{2})\.log$/.exec(f)
        if (!m) continue
        const t = Date.parse(m[1] + 'T00:00:00Z')
        if (Number.isFinite(t) && t < cutoff) {
          fs.rmSync(path.join(logsDir, f), { force: true })
        }
      }
    } catch {
      // 失敗しても無視
    }
  }

  const api = {
    log(level, phase, fields = {}) {
      if (!LEVELS.includes(level)) level = 'info'
      writeLine(level, phase, fields)
    },
    debug(phase, fields) {
      this.log('debug', phase, fields)
    },
    info(phase, fields) {
      this.log('info', phase, fields)
    },
    warn(phase, fields) {
      this.log('warn', phase, fields)
    },
    error(phase, fields) {
      this.log('error', phase, fields)
    },
    async withTiming(phase, fn, extraFields = {}) {
      const start = Date.now()
      this.info(`${phase}.start`, extraFields)
      try {
        const result = await fn()
        this.info(`${phase}.done`, { ...extraFields, durationMs: Date.now() - start })
        return result
      } catch (err) {
        this.error(`${phase}.error`, {
          ...extraFields,
          durationMs: Date.now() - start,
          error: err
        })
        throw err
      }
    },
    cleanupOldLogs,
    currentLogPath
  }

  return api
}
