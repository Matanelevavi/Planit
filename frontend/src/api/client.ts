import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { StringKey } from '../i18n/strings'

/**
 * Same-origin by default (`/api` is proxied to FastAPI in dev and by the web server in
 * production), which keeps the httpOnly refresh cookie first-party.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
  timeout: 15_000,
})

// The short-lived access token lives only in memory: nothing for an XSS payload to read from storage.
let accessToken: string | null = null
let onSessionLost: (() => void) | null = null

export const setAccessToken = (token: string | null) => {
  accessToken = token
}
export const setSessionLostHandler = (fn: (() => void) | null) => {
  onSessionLost = fn
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']
let refreshing: Promise<string | null> | null = null

/** Exchange the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<string | null> {
  refreshing ??= api
    .post<{ access_token: string }>('/auth/refresh')
    .then((r) => {
      setAccessToken(r.data.access_token)
      return r.data.access_token
    })
    .catch(() => {
      setAccessToken(null)
      return null
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

type Retryable = InternalAxiosRequestConfig & { _retried?: boolean }

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const config = error.config as Retryable | undefined
    const url = config?.url ?? ''
    if (error.response?.status === 401 && config && !config._retried && !NO_REFRESH.some((p) => url.startsWith(p))) {
      config._retried = true
      const token = await refreshSession()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
        return api(config)
      }
      onSessionLost?.()
    }
    return Promise.reject(error)
  },
)

/** Map any failed request to a user-facing message key (never show raw server text). */
export function errorKey(error: unknown): StringKey {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'networkError'
    switch (error.response.status) {
      case 429:
        return 'tooManyAttempts'
      case 401:
        return 'invalidCredentials'
    }
  }
  return 'genericError'
}
