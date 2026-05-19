#!/usr/bin/env node
/**
 * better-sqlite3 をElectron向けにリビルドするスクリプト。
 * electron-rebuild CLI がElectronバージョンを自動検出できない環境のため
 * @electron/rebuild のプログラムAPIを使って明示的に指定する。
 */
const { rebuild } = require('@electron/rebuild')
const path = require('path')
const { configureNativeBuildEnv } = require('./native-build-env')

const electronPkg = require('electron/package.json')
const electronVersion = electronPkg.version
const { cachePath, pythonPath } = configureNativeBuildEnv()

console.log(`Rebuilding better-sqlite3 for Electron ${electronVersion}...`)
console.log(`Using npm cache: ${cachePath}`)
if (pythonPath) {
  console.log(`Using Python for node-gyp: ${pythonPath}`)
}

rebuild({
  buildPath: path.resolve(__dirname, '..'),
  electronVersion,
  onlyModules: ['better-sqlite3'],
  force: true
})
  .then(() => {
    console.log('better-sqlite3 rebuilt successfully.')
  })
  .catch((err) => {
    console.error('Rebuild failed:', err.message)
    process.exit(1)
  })
