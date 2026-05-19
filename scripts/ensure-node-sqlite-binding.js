#!/usr/bin/env node
/**
 * Ensures better-sqlite3 is usable from the current Node.js runtime.
 *
 * Electron development uses scripts/rebuild-native.js for the Electron ABI.
 * Vitest runs under Node.js, so test setup must verify the Node ABI instead
 * of blindly rebuilding and depending on the user's global npm cache.
 */
const { spawnSync } = require('child_process')
const path = require('path')
const { configureNativeBuildEnv } = require('./native-build-env')

const projectRoot = path.resolve(__dirname, '..')

function checkBinding() {
  try {
    const Database = require('better-sqlite3')
    const db = new Database(':memory:')
    db.prepare('select 1').get()
    db.close()
    return null
  } catch (error) {
    return error
  }
}

function rebuildForNode() {
  const { cachePath, pythonPath } = configureNativeBuildEnv()
  const env = {
    ...process.env
  }
  const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm'
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm rebuild better-sqlite3']
      : ['rebuild', 'better-sqlite3']

  console.log(`better-sqlite3 binding is missing for Node ${process.versions.node}.`)
  console.log(`Rebuilding better-sqlite3 with npm cache: ${cachePath}`)
  if (pythonPath) {
    console.log(`Using Python for node-gyp: ${pythonPath}`)
  } else {
    console.log('Python was not auto-detected; npm/node-gyp will use its normal discovery.')
  }

  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env,
    stdio: 'inherit'
  })

  if (result.error || result.status !== 0) {
    console.error('')
    console.error('Failed to rebuild better-sqlite3 for the Node.js test runtime.')
    if (result.error) {
      console.error(result.error.message)
    }
    console.error('If this is a Codex runtime, ensure the bundled Python path is available.')
    console.error('On Windows, node-gyp may also require Visual Studio C++ build tools.')
    process.exit(result.status || 1)
  }
}

const firstError = checkBinding()
if (!firstError) {
  console.log('better-sqlite3 Node binding is ready.')
  process.exit(0)
}

console.log(firstError.message.split('\n')[0])
rebuildForNode()

const secondError = checkBinding()
if (secondError) {
  console.error(secondError.message)
  process.exit(1)
}

console.log('better-sqlite3 Node binding rebuilt successfully.')
