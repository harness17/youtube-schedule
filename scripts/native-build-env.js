const fs = require('fs')
const os = require('os')
const path = require('path')

function findBundledPython() {
  const configuredPython = process.env.npm_config_python || process.env.PYTHON
  if (configuredPython && fs.existsSync(configuredPython)) {
    return configuredPython
  }

  const codexPython = path.join(
    os.homedir(),
    '.cache',
    'codex-runtimes',
    'codex-primary-runtime',
    'dependencies',
    'python',
    'python.exe'
  )

  if (fs.existsSync(codexPython)) {
    return codexPython
  }

  return null
}

function configureNativeBuildEnv() {
  const cachePath = process.env.YOUTOM_NPM_CACHE || path.join(os.tmpdir(), 'youtom-npm-cache')
  const pythonPath = findBundledPython()

  fs.mkdirSync(cachePath, { recursive: true })
  process.env.npm_config_cache = cachePath

  if (pythonPath) {
    process.env.PYTHON = pythonPath
  }

  return { cachePath, pythonPath }
}

module.exports = {
  configureNativeBuildEnv
}
