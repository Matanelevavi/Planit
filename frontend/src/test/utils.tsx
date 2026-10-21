import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthContext, type AuthValue } from '../auth/context'
import { ToastProvider } from '../components/ToastProvider'
import { I18nProvider } from '../i18n/I18nProvider'

export const fakeAuth = (over: Partial<AuthValue> = {}): AuthValue => ({
  status: 'authed',
  user: { id: 1, email: 'me@example.com', created_at: '2025-01-01T00:00:00Z' },
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  adoptToken: async () => {},
  clearSession: () => {},
  ...over,
})

export function renderApp(ui: ReactElement, opts: { route?: string; auth?: Partial<AuthValue>; lang?: 'he' | 'en' } = {}) {
  localStorage.setItem('planit.lang', opts.lang ?? 'en')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={[opts.route ?? '/']}>
          <ToastProvider>
            <AuthContext.Provider value={fakeAuth(opts.auth)}>{ui}</AuthContext.Provider>
          </ToastProvider>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}
