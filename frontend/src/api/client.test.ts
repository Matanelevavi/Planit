import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, errorKey, refreshSession, setAccessToken, setSessionLostHandler } from './client'

type Handler = (config: InternalAxiosRequestConfig) => { status: number; data?: unknown }

function useServer(handler: Handler) {
  const calls: string[] = []
  const adapter: AxiosAdapter = async (config) => {
    calls.push(`${config.method} ${config.url} ${config.headers.Authorization ?? ''}`.trim())
    const { status, data } = handler(config)
    const response = { data, status, statusText: '', headers: {}, config }
    if (status >= 400) throw new AxiosError('fail', 'ERR', config, null, response)
    return response
  }
  api.defaults.adapter = adapter
  return calls
}

beforeEach(() => setAccessToken(null))
afterEach(() => setSessionLostHandler(null))

describe('api client', () => {
  it('sends the in-memory access token as a Bearer header', async () => {
    const calls = useServer(() => ({ status: 200, data: [] }))
    setAccessToken('tok')
    await api.get('/goals/')
    expect(calls[0]).toBe('get /goals/ Bearer tok')
  })

  it('refreshes once on 401 and retries the original request', async () => {
    const calls = useServer((c) => {
      if (c.url === '/auth/refresh') return { status: 200, data: { access_token: 'fresh' } }
      return c.headers.Authorization === 'Bearer fresh' ? { status: 200, data: ['ok'] } : { status: 401 }
    })
    setAccessToken('expired')
    const r = await api.get('/goals/')
    expect(r.data).toEqual(['ok'])
    expect(calls).toEqual(['get /goals/ Bearer expired', 'post /auth/refresh Bearer expired', 'get /goals/ Bearer fresh'])
  })

  it('shares a single refresh between concurrent 401s', async () => {
    const calls = useServer((c) => {
      if (c.url === '/auth/refresh') return { status: 200, data: { access_token: 'fresh' } }
      return c.headers.Authorization === 'Bearer fresh' ? { status: 200, data: 1 } : { status: 401 }
    })
    setAccessToken('expired')
    await Promise.all([api.get('/goals/'), api.get('/goals/summary'), api.get('/auth/me')])
    expect(calls.filter((c) => c.includes('/auth/refresh'))).toHaveLength(1)
  })

  it('signals session loss when the refresh fails', async () => {
    useServer((c) => (c.url === '/auth/refresh' ? { status: 401 } : { status: 401 }))
    const lost = vi.fn()
    setSessionLostHandler(lost)
    setAccessToken('expired')
    await expect(api.get('/goals/')).rejects.toBeTruthy()
    expect(lost).toHaveBeenCalledTimes(1)
  })

  it('does not try to refresh failed logins', async () => {
    const calls = useServer(() => ({ status: 401 }))
    await expect(api.post('/auth/login', {})).rejects.toBeTruthy()
    expect(calls).toHaveLength(1)
  })

  it('does not loop forever when the retry also returns 401', async () => {
    const calls = useServer((c) => (c.url === '/auth/refresh' ? { status: 200, data: { access_token: 'x' } } : { status: 401 }))
    await expect(api.get('/goals/')).rejects.toBeTruthy()
    expect(calls.filter((c) => c.startsWith('get /goals/'))).toHaveLength(2)
  })

  it('refreshSession resolves null when there is no valid cookie', async () => {
    useServer(() => ({ status: 401 }))
    expect(await refreshSession()).toBeNull()
  })
})

describe('errorKey', () => {
  const err = (status?: number) =>
    new AxiosError('x', 'E', undefined, null, status ? ({ status } as never) : undefined)
  it('maps failures to safe message keys', () => {
    expect(errorKey(err())).toBe('networkError')
    expect(errorKey(err(429))).toBe('tooManyAttempts')
    expect(errorKey(err(401))).toBe('invalidCredentials')
    expect(errorKey(err(500))).toBe('genericError')
    expect(errorKey(new Error('boom'))).toBe('genericError')
  })
})
