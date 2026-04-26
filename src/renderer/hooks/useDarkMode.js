import { useState, useEffect, useRef } from 'react'

export function useDarkMode() {
  const [darkMode, setDarkMode] = useState(false)
  // 初回ロード完了フラグ。ロード前に setDarkMode(false) が発火すると
  // 設定値が上書きされるため、ロード後まで electron-store への書き込みを抑制する
  const darkModeLoaded = useRef(false)

  useEffect(() => {
    window.api.getSetting('darkMode', false).then((val) => {
      darkModeLoaded.current = true
      setDarkMode(val)
    })
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    if (darkModeLoaded.current) {
      window.api.setSetting('darkMode', darkMode)
    }
  }, [darkMode])

  return { darkMode, setDarkMode }
}
