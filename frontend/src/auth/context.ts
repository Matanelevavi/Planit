import { createContext, useContext } from 'react'
import type { User } from '../api/types'

export interface AuthValue {
  status: 'loading' | 'authed' | 'anon'
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Called after an operation that replaced the session (e.g. password change). */
  adoptToken: (token: string) => Promise<void>
  clearSession: () => void
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
