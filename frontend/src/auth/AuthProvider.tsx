import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, refreshSession, setAccessToken, setSessionLostHandler } from '../api/client'
import type { User } from '../api/types'
import { AuthContext, type AuthValue } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<AuthValue['status']>('loading')
  const [user, setUser] = useState<User | null>(null)

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    setStatus('anon')
    qc.clear() // never show the previous user's data to the next one
  }, [qc])

  const loadUser = useCallback(async () => {
    const me = await api.get<User>('/auth/me')
    setUser(me.data)
    setStatus('authed')
  }, [])

  // Restore the session from the refresh cookie on first load.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await refreshSession()
      if (cancelled) return
      if (!token) return setStatus('anon')
      try {
        await loadUser()
      } catch {
        if (!cancelled) setStatus('anon')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadUser])

  useEffect(() => {
    setSessionLostHandler(clearSession)
    return () => setSessionLostHandler(null)
  }, [clearSession])

  const authenticate = useCallback(
    async (path: '/auth/login' | '/auth/register', email: string, password: string) => {
      const r = await api.post<{ access_token: string }>(path, { email, password })
      qc.clear()
      setAccessToken(r.data.access_token)
      await loadUser()
    },
    [loadUser, qc],
  )

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      login: (e, p) => authenticate('/auth/login', e, p),
      register: (e, p) => authenticate('/auth/register', e, p),
      logout: async () => {
        try {
          await api.post('/auth/logout')
        } finally {
          clearSession()
        }
      },
      adoptToken: async (token) => {
        setAccessToken(token)
        await loadUser()
      },
      clearSession,
    }),
    [status, user, authenticate, loadUser, clearSession],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
