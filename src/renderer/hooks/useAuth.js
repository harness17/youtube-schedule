import { useState, useEffect, useCallback } from 'react'

export function useAuth({ onAuthenticated } = {}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [loginSuccess, setLoginSuccess] = useState(false)
  const [credentialsMissing, setCredentialsMissing] = useState(false)
  const [credentialsPath, setCredentialsPath] = useState('')
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const result = await window.api.checkAuth()
        setCredentialsMissing(Boolean(result.credentialsMissing))
        setCredentialsPath(result.credentialsPath || '')
        setIsAuthenticated(Boolean(result.isAuthenticated))
        if (result.isAuthenticated) onAuthenticated?.()
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
    if (result.error) {
      setAuthError(result.error)
      if (result.error === 'CREDENTIALS_NOT_FOUND') {
        setCredentialsMissing(true)
        setCredentialsPath(result.credentialsPath || '')
      }
      return result
    }
    if (result.isAuthenticated) {
      setAuthError('')
      setLoginSuccess(true)
      setTimeout(() => {
        setLoginSuccess(false)
        setIsAuthenticated(true)
        onAuthenticated?.()
      }, 2000)
    }
    return result
  }, [onAuthenticated])

  const handleImportCredentials = useCallback(async () => {
    const result = await window.api.importCredentials()
    if (result.success) {
      setCredentialsMissing(false)
      setCredentialsPath(result.credentialsPath || credentialsPath)
      setAuthError('')
    } else if (result.error) {
      setAuthError(result.error)
    }
    return result
  }, [credentialsPath])

  const handleLogout = useCallback(async () => {
    await window.api.logout()
    setIsAuthenticated(false)
    onAuthenticated?.()
  }, [onAuthenticated])

  return {
    isAuthenticated,
    authLoading,
    loginSuccess,
    credentialsMissing,
    credentialsPath,
    authError,
    handleLogin,
    handleLogout,
    handleImportCredentials
  }
}
