import { useState, useEffect, useCallback } from 'react'

export function useAuth({ onAuthenticated } = {}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const [credentialsMissing, setCredentialsMissing] = useState(false)
  const [credentialsPath, setCredentialsPath] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const result = await window.api.checkAuth()
        if (result.error === 'CREDENTIALS_NOT_FOUND') {
          setCredentialsMissing(true)
          setCredentialsPath(result.credentialsPath || '')
        } else {
          setIsAuthenticated(result.isAuthenticated)
          if (result.isAuthenticated) onAuthenticated?.()
        }
      } catch {
        // silent — 認証エラーは isAuthenticated=false のままにする
      } finally {
        setAuthLoading(false)
      }
    })()
  }, [onAuthenticated])

  const handleLogin = useCallback(async () => {
    setAuthLoading(true)
    const result = await window.api.login()
    setAuthLoading(false)
    if (result.isAuthenticated) {
      setLoginSuccess(true)
      setTimeout(() => {
        setLoginSuccess(false)
        setIsAuthenticated(true)
        onAuthenticated?.()
      }, 2000)
    }
  }, [onAuthenticated])

  const handleLogout = useCallback(async () => {
    await window.api.logout()
    setIsAuthenticated(false)
  }, [])

  return {
    isAuthenticated,
    authLoading,
    loginSuccess,
    credentialsMissing,
    credentialsPath,
    handleLogin,
    handleLogout
  }
}
